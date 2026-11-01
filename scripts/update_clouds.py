#!/usr/bin/env python3
"""Crop native DWD ICON-D2 CEILING data once per complete forecast run.

The resulting regional point cloud retains native cell centres and missing-value
bitmaps. It never derives ceiling from cloud cover or temperature/dew point.
Install requirements-clouds.txt only for this ingestion command; imports and
deterministic tests do not require the GRIB decoder.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
import json
import math
from pathlib import Path
import re
import sys
from urllib.parse import quote, unquote, urljoin
from urllib.request import Request, urlopen

UTC = timezone.utc
BASE = "https://opendata.dwd.de/weather/nwp/v1/m/icon-d2/p/"
RUNS_URL = BASE + "CEILING/r/"
DOCUMENTATION = "https://rcccm.dwd.de/SharedDocs/downloads/DE/modelldokumentationen/nwv/icon_d2/icon_d2_dbbeschr_aktuell.pdf?nn=16102&view=nasPublication"
REGION = {"south": 48.4, "north": 49.7, "west": 12.9, "east": 15.7}
CACHE_VERSION = 1
MAX_BYTES = 3_000_000
USER_AGENT = "Heli-Briefing/0.2 (https://github.com/xefensor/heli-briefing)"


def iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def now_iso() -> str:
    return iso(datetime.now(UTC))


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.links.extend(value for key, value in attrs if key == "href" and value)


def listing_links(text: str) -> list[str]:
    parser = Links()
    parser.feed(text)
    return parser.links


def retrieve(url: str, limit=MAX_BYTES) -> bytes:
    if not url.startswith(BASE):
        raise ValueError("Only the documented DWD product origin is permitted")
    with urlopen(Request(url, headers={"User-Agent": USER_AGENT}), timeout=25) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError("DWD response exceeds the bounded product size")
    return data


def run_candidates(text: str) -> list[datetime]:
    values = []
    for link in listing_links(text):
        name = unquote(link).rstrip("/")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:00", name):
            continue
        try:
            values.append(datetime.strptime(name, "%Y-%m-%dT%H:%M").replace(tzinfo=UTC))
        except ValueError:
            pass
    return sorted(set(values), reverse=True)


def step_links(text: str) -> dict[int, str]:
    result = {}
    for link in listing_links(text):
        match = re.fullmatch(r"PT(\d{3})H00M\.grib2", link)
        if match and 0 <= int(match[1]) <= 48:
            result[int(match[1])] = link
    return result


def run_token(run: datetime) -> str:
    return run.strftime("%Y%m%d%H")


def step_directory(parameter: str, run: datetime) -> str:
    if parameter not in {"CEILING", "CLAT", "CLON", "HSURF"}:
        raise ValueError("Unsupported native field")
    name = quote(run.strftime("%Y-%m-%dT%H:%M"), safe="-")
    return f"{BASE}{parameter}/r/{name}/s/"


def discover_run() -> tuple[datetime, dict[int, str]]:
    candidates = run_candidates(retrieve(RUNS_URL).decode("utf-8"))
    # A publishing run may be incomplete. Prefer the newest complete run, and do
    # not label an arbitrary partial collection as a complete 48-hour forecast.
    for run in candidates[:3]:
        directory = step_directory("CEILING", run)
        steps = step_links(retrieve(directory).decode("utf-8"))
        if set(range(49)).issubset(steps):
            return run, {step: urljoin(directory, steps[step]) for step in range(49)}
    raise ValueError("No complete 0–48 hour native CEILING run is currently published")


def cache_key(run: datetime) -> str:
    return f"icon-d2-ceiling-native-v{CACHE_VERSION}-{run_token(run)}"


def cached_file(url: str, directory: Path, name: str) -> Path:
    path = directory / name
    if path.exists() and path.stat().st_size:
        return path
    data = retrieve(url)
    if not data.startswith(b"GRIB"):
        raise ValueError("DWD did not return a GRIB product")
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_bytes(data)
    temp.replace(path)
    return path


def read_grib(path: Path, field: str) -> dict:
    try:
        import eccodes as ec
    except ImportError as error:
        raise RuntimeError("Native cloud ingestion needs requirements-clouds.txt") from error
    with path.open("rb") as stream:
        handle = ec.codes_grib_new_from_file(stream)
        if handle is None:
            raise ValueError("Empty GRIB product")
        try:
            short = ec.codes_get(handle, "shortName")
            units = ec.codes_get(handle, "units")
            expected = {"CEILING": ("ceil", "m"), "CLAT": ("tlat", "Degree N"), "CLON": ("tlon", "Degree E"), "HSURF": ("HSURF", "m")}
            if (short, units) != expected[field]:
                raise ValueError(f"Unexpected {field} identity/units: {short}/{units}")
            if ec.codes_get(handle, "gridType") != "unstructured_grid":
                raise ValueError("Expected the native unstructured ICON-D2 mesh")
            run = datetime.strptime(f"{ec.codes_get(handle, 'dataDate'):08d}{ec.codes_get(handle, 'dataTime'):04d}", "%Y%m%d%H%M").replace(tzinfo=UTC)
            valid = datetime.strptime(f"{ec.codes_get(handle, 'validityDate'):08d}{ec.codes_get(handle, 'validityTime'):04d}", "%Y%m%d%H%M").replace(tzinfo=UTC)
            values = ec.codes_get_values(handle)
            bitmap = ec.codes_get_array(handle, "bitmap") if ec.codes_get(handle, "bitmapPresent") else None
            if len(values) != ec.codes_get(handle, "numberOfDataPoints") or (bitmap is not None and len(bitmap) != len(values)):
                raise ValueError("GRIB values and native-grid bitmap are misaligned")
            return {"uuid": ec.codes_get(handle, "uuidOfHGrid"), "gridNumber": ec.codes_get(handle, "numberOfGridUsed"), "values": values, "bitmap": bitmap, "run": run, "valid": valid}
        finally:
            ec.codes_release(handle)


def same_grid(*products: dict) -> None:
    identities = {(p["uuid"], p["gridNumber"], len(p["values"])) for p in products}
    if len(identities) != 1:
        raise ValueError("Coordinate/height fields do not describe the same native grid")


def selected_indices(latitudes, longitudes, region=REGION) -> list[int]:
    if len(latitudes) != len(longitudes):
        raise ValueError("Coordinate arrays have different sizes")
    return [i for i, (lat, lon) in enumerate(zip(latitudes, longitudes))
            if math.isfinite(float(lat)) and math.isfinite(float(lon))
            and region["south"] <= lat <= region["north"]
            and region["west"] <= lon <= region["east"]]


def selected_values(values, bitmap, indices: list[int]) -> list[int | None]:
    result = []
    for index in indices:
        value = float(values[index])
        # Do not test value==9999: a real 9999 m reading must survive when its
        # bitmap says present. The bitmap defines native missing values.
        missing = bitmap is not None and not bitmap[index]
        result.append(None if missing or not math.isfinite(value) or abs(value) > 1_000_000 else round(value))
    return result


def fallback(previous: dict | None, error: Exception, attempted_at: str) -> dict:
    if previous and previous.get("schemaVersion") == 1 and previous.get("points") and previous.get("frames"):
        result = dict(previous)
        result.update(status="stale", error=str(error), attemptedAt=attempted_at)
        return result
    return {"schemaVersion": 1, "status": "unavailable", "error": str(error), "attemptedAt": attempted_at, "retrievedAt": None, "runTime": None, "provider": "DWD", "model": "ICON-D2", "product": "CEILING", "units": "m MSL", "region": REGION, "points": [], "frames": [], "sourceUrl": RUNS_URL, "documentationUrl": DOCUMENTATION, "attribution": "Deutscher Wetterdienst · CC BY 4.0"}


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    temp.replace(path)


def collect(run: datetime, urls: dict[int, str], cache_dir: Path) -> dict:
    directory = cache_dir / cache_key(run)
    assembled = directory / "clouds.json"
    if assembled.exists():
        payload = json.loads(assembled.read_text())
        if payload.get("schemaVersion") == 1 and payload.get("runTime") == iso(run) and len(payload.get("frames", [])) == 49:
            return payload

    products = {}
    for field in ("CLAT", "CLON", "HSURF"):
        url = urljoin(step_directory(field, run), "PT000H00M.grib2")
        products[field] = read_grib(cached_file(url, directory, field + ".grib2"), field)
    same_grid(*products.values())
    if any(product["run"] != run for product in products.values()):
        raise ValueError("Coordinate/terrain product run does not match selected model run")
    indices = selected_indices(products["CLAT"]["values"], products["CLON"]["values"])
    if not indices:
        raise ValueError("The native grid has no cells in the requested region")
    elevation = selected_values(products["HSURF"]["values"], products["HSURF"]["bitmap"], indices)
    points = [{"lat": round(float(products["CLAT"]["values"][i]), 5), "lon": round(float(products["CLON"]["values"][i]), 5), "elevationMsl": h} for i, h in zip(indices, elevation)]

    def frame(step: int) -> dict:
        url = urls[step]
        product = read_grib(cached_file(url, directory, f"CEILING-{step:03d}.grib2"), "CEILING")
        same_grid(products["CLAT"], product)
        if product["run"] != run or product["valid"] != run + timedelta(hours=step):
            raise ValueError("CEILING run/validity does not match its advertised forecast step")
        return {"leadHours": step, "validAt": iso(product["valid"]), "values": selected_values(product["values"], product["bitmap"], indices), "sourceUrl": url}

    frames = []
    # At most four bounded native-product requests; completed runs are immutable
    # and restored by the Actions cache rather than downloaded every 20 minutes.
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(frame, step) for step in range(49)]
        for future in as_completed(futures):
            frames.append(future.result())
    frames.sort(key=lambda item: item["leadHours"])
    payload = {"schemaVersion": 1, "status": "ok", "error": None, "retrievedAt": now_iso(), "attemptedAt": now_iso(), "runTime": iso(run), "provider": "DWD", "model": "ICON-D2", "product": "CEILING", "units": "m MSL", "definition": "Height above mean sea level where scale/sub-scale cloud coverage first exceeds 50% looking upward from ground; excludes convective contribution.", "missingMeaning": "Native GRIB missing/undefined diagnostic; does not mean clear sky or unlimited observed ceiling.", "region": REGION, "grid": {"type": "native-unstructured", "uuid": products["CLAT"]["uuid"], "number": products["CLAT"]["gridNumber"], "resolutionKm": 2.1, "sampling": "nearest native cell centre", "maxDistanceKm": 3.5, "heightRoundingMetres": 1}, "points": points, "frames": frames, "sourceUrl": step_directory("CEILING", run), "documentationUrl": DOCUMENTATION, "licenseUrl": "https://creativecommons.org/licenses/by/4.0/", "attribution": "Deutscher Wetterdienst · CC BY 4.0"}
    write_json(assembled, payload)
    # GRIB downloads are reproducible intermediates. The reusable per-run cache
    # only needs the compact, assembled crop, not ~40 MB of full-domain products.
    for path in directory.glob("*.grib2"):
        path.unlink()
    return payload


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("web/data/clouds.json"))
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache/clouds"))
    parser.add_argument("--cache-key", action="store_true", help="Discover newest complete run; no ecCodes import")
    args = parser.parse_args(argv)
    previous = None
    if args.output.exists():
        try:
            previous = json.loads(args.output.read_text())
        except (OSError, ValueError):
            pass
    try:
        run, urls = discover_run()
        if args.cache_key:
            print(cache_key(run))
            return 0
        payload = collect(run, urls, args.cache_dir)
    except Exception as error:
        if args.cache_key:
            print(f"Cloud run discovery failed: {error}", file=sys.stderr)
            return 1
        payload = fallback(previous, error, now_iso())
        print(f"Cloud ingestion {payload['status']}: {error}", file=sys.stderr)
    write_json(args.output, payload)
    print(f"Cloud product {payload['status']}; {len(payload['points'])} cells, {len(payload['frames'])} valid times")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
