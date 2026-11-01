#!/usr/bin/env python3
"""Build a timestamped AWC snapshot for a static site; never invent reports.

The browser cannot query AWC because it does not permit CORS. This small
collector runs during publication and scheduled refreshes. A failed section
retains the last genuine section with its old retrieval time and a stale flag.
Source: https://aviationweather.gov/data/api/ (verified 2026-11-01).
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import json
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

STATIONS = ("LKCS", "LKHS", "LKPR", "LKKB", "LKPD", "LKTB", "LKKV", "LOWL", "LOWW")
FIRS = ("LKAA", "LOVV", "EDMM", "LZBB")
ROOT = Path(__file__).resolve().parents[1]
USER_AGENT = "heli-briefing/0.1 (+https://github.com/xefensor/heli-briefing)"
MAX_BYTES = 8 * 1024 * 1024
RADAR_DIRECTORY = "https://opendata.chmi.cz/meteorology/weather/radar/composite/pseudocappi2km/png/"
RADAR_DOCUMENTATION = "https://opendata.chmi.cz/meteorology/weather/radar/radar_description_en.pdf"


class FeedError(Exception):
    """The provider did not deliver a usable response."""


def iso_time(value):
    """Normalize provider UTC instants; keep missing and malformed times null."""
    if value is None or isinstance(value, bool):
        return None
    try:
        if isinstance(value, (int, float)):
            instant = datetime.fromtimestamp(value, timezone.utc)
        elif isinstance(value, str) and value.strip():
            instant = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
            if instant.tzinfo is None:
                return None  # Never assume a zone the source did not provide.
            instant = instant.astimezone(timezone.utc)
        else:
            return None
        return instant.isoformat(timespec="seconds").replace("+00:00", "Z")
    except (ValueError, OverflowError, OSError):
        return None


def utc_now():
    return iso_time(datetime.now(timezone.utc).timestamp())


def normalize_report(kind, source):
    """Keep original decoding intact; normalize only explicit source metadata."""
    raw_field = {"metar": "rawOb", "taf": "rawTAF", "sigmet": "rawSigmet"}[kind]
    raw = source.get(raw_field)
    raw = raw if isinstance(raw, str) else None
    words = set(re.findall(r"\b[A-Z]+\b", raw or ""))
    station = source.get("icaoId")
    observed = iso_time(source.get("obsTime")) if kind == "metar" else None
    issued = iso_time(source.get("issueTime")) if kind != "metar" else None
    start = iso_time(source.get("validTimeFrom")) if kind != "metar" else None
    end = iso_time(source.get("validTimeTo")) if kind != "metar" else None
    serial = str(source.get("seriesId", ""))
    identity = ":".join(str(x) for x in (kind, station or source.get("firId") or "unknown", observed or issued or start or "undated", serial))
    return {
        "id": identity,
        "station": station,
        "fir": source.get("firId") if kind == "sigmet" else None,
        "raw": raw,
        "issuedAt": issued,
        "observedAt": observed,
        "receivedAt": iso_time(source.get("receiptTime", source.get("dbPopTime"))),
        "validFrom": start,
        "validTo": end,
        "cancelled": "CNL" in words,
        "nil": "NIL" in words,
        "amended": "AMD" in words,
        "corrected": "COR" in words,
        "source": source,
    }


def feed_urls():
    params = urlencode({"ids": ",".join(STATIONS), "format": "json"})
    return {
        "metar": "https://aviationweather.gov/api/data/metar?" + params,
        "taf": "https://aviationweather.gov/api/data/taf?" + params,
        # The documented SIGMET API has no FIR/bbox parameter. The complete
        # provider cache avoids its 400-result limit; filter FIRs locally.
        "sigmet": "https://aviationweather.gov/data/cache/sigmets.cache.json.gz",
    }


def fetch_json(url, timeout=15):
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(request, timeout=timeout) as response:
            if response.status == 204:
                return []
            body = response.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES:
                raise FeedError("Response exceeds the collector size limit")
            if body[:2] == b"\x1f\x8b":
                body = gzip.decompress(body)
                if len(body) > MAX_BYTES:
                    raise FeedError("Expanded response exceeds the collector size limit")
            result = json.loads(body)
    except HTTPError as error:
        raise FeedError(f"AWC HTTP {error.code}") from error
    except (URLError, TimeoutError, OSError, ValueError, EOFError) as error:
        raise FeedError(f"AWC response unavailable ({type(error).__name__})") from error
    if not isinstance(result, list) or not all(isinstance(row, dict) for row in result):
        raise FeedError("AWC response is not a report array")
    return result


def radar_from_listing(listing, timestamp):
    """Discover an actual published PNG; its observation time comes from its name.

    Whole-image bounds (including ancillary margin) are from the official
    radar_description_en.pdf v1.3, p27. The data footprint is smaller; applying
    the data bounds to the entire PNG would georeference it incorrectly.
    """
    matches = re.findall(r'href="(pacz2gmaps3\.z_cappi020\.(\d{8})\.(\d{4})\.0\.png)"', listing)
    candidates = []
    for filename, day, clock in matches:
        try:
            observed = datetime.strptime(day + clock, "%Y%m%d%H%M").replace(tzinfo=timezone.utc)
            candidates.append((observed, filename))
        except ValueError:
            continue
    if not candidates:
        raise FeedError("ČHMÚ directory contains no recognized radar PNG")
    observed, filename = max(candidates)
    return {
        "status": "ok",
        "retrievedAt": timestamp,
        "attemptedAt": timestamp,
        "observedAt": iso_time(observed.timestamp()),
        "url": RADAR_DIRECTORY + filename,
        "bounds": [[48.047, 11.267], [52.167, 20.770]],
        "dataBounds": [[48.047, 11.267], [51.458, 19.624]],
        "legendUrl": "https://opendata.chmi.cz/meteorology/weather/radar/scl/scl-dbz-mmh.png",
        "sourceUrl": RADAR_DIRECTORY,
        "documentationUrl": RADAR_DOCUMENTATION,
        "product": "PseudoCAPPI_2km",
        "measurement": "Radar reflectivity at 2 km AMSL; observed five-minute composite, not extrapolation",
        "attribution": "ČHMÚ / CZRAD · CC BY 4.0",
        "error": None,
    }


def fetch_radar(timestamp):
    request = Request(RADAR_DIRECTORY, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    try:
        with urlopen(request, timeout=15) as response:
            body = response.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES:
                raise FeedError("ČHMÚ radar directory exceeds the collector size limit")
        return radar_from_listing(body.decode("utf-8"), timestamp)
    except HTTPError as error:
        raise FeedError(f"ČHMÚ radar HTTP {error.code}") from error
    except (URLError, TimeoutError, OSError, UnicodeError) as error:
        raise FeedError(f"ČHMÚ radar unavailable ({type(error).__name__})") from error


def failed_radar(previous, timestamp, message):
    if isinstance(previous, dict) and previous.get("url") and previous.get("retrievedAt"):
        section = dict(previous)
        section.update(status="stale", attemptedAt=timestamp, error=message)
        return section
    return {
        "status": "unavailable", "retrievedAt": None, "attemptedAt": timestamp,
        "observedAt": None, "url": None, "bounds": None, "legendUrl": None,
        "sourceUrl": RADAR_DIRECTORY, "documentationUrl": RADAR_DOCUMENTATION,
        "error": message,
    }


def successful_section(kind, rows, url, timestamp):
    if kind == "sigmet":
        rows = [row for row in rows if row.get("firId") in FIRS]
    else:
        rows = [row for row in rows if row.get("icaoId") in STATIONS]
    items = [normalize_report(kind, row) for row in rows]
    section = {
        "status": "ok" if items else "empty",
        "retrievedAt": timestamp,
        "attemptedAt": timestamp,
        "error": None,
        "sourceUrl": url,
        "items": items,
    }
    if kind == "sigmet":
        section["firScope"] = list(FIRS)
    else:
        section["requestedStations"] = list(STATIONS)
        section["missingStations"] = [station for station in STATIONS if not any(item["station"] == station for item in items)]
    return section


def failed_section(previous, url, timestamp, message):
    if isinstance(previous, dict) and isinstance(previous.get("items"), list) and previous.get("retrievedAt"):
        section = dict(previous)
        section.update(status="stale", attemptedAt=timestamp, error=message, sourceUrl=url)
        return section
    return {
        "status": "unavailable", "retrievedAt": None, "attemptedAt": timestamp,
        "error": message, "sourceUrl": url, "items": [],
    }


def build_snapshot(previous=None, fetcher=fetch_json, timestamp=None, pause=0.7, radar_fetcher=fetch_radar):
    previous = previous if isinstance(previous, dict) else {}
    snapshot = {
        "schemaVersion": 1,
        "generatedAt": timestamp or utc_now(),
        "attribution": "NOAA / National Weather Service Aviation Weather Center; original issuing authorities remain identified in each bulletin.",
        "documentationUrl": "https://aviationweather.gov/data/api/",
    }
    for index, (kind, url) in enumerate(feed_urls().items()):
        if index and pause:
            time.sleep(pause)
        attempted_at = timestamp or utc_now()
        try:
            rows = fetcher(url)
            snapshot[kind] = successful_section(kind, rows, url, timestamp or utc_now())
        except (FeedError, TimeoutError, OSError, ValueError) as error:
            snapshot[kind] = failed_section(previous.get(kind), url, attempted_at, str(error))
    try:
        snapshot["radar"] = radar_fetcher(timestamp or utc_now())
    except (FeedError, TimeoutError, OSError, ValueError) as error:
        snapshot["radar"] = failed_radar(previous.get("radar"), timestamp or utc_now(), str(error))
    snapshot["generatedAt"] = timestamp or utc_now()
    return snapshot


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "web/data/aviation.json")
    args = parser.parse_args()
    try:
        previous = json.loads(args.output.read_text()) if args.output.exists() else {}
    except (OSError, ValueError):
        previous = {}
    snapshot = build_snapshot(previous)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(args.output.suffix + ".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(args.output)
    for kind in feed_urls():
        section = snapshot[kind]
        print(f"{kind}: {section['status']}, {len(section['items'])} report(s), retrieved {section['retrievedAt']}")
    print(f"radar: {snapshot['radar']['status']}, observed {snapshot['radar']['observedAt']}")
    # An honest unavailable/stale section is publishable. Only fatal filesystem
    # or programming errors should prevent a site update during an AWC outage.
    return 0


if __name__ == "__main__":
    sys.exit(main())
