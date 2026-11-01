#!/usr/bin/env python3
"""Build a timestamped AWC snapshot for a static site; never invent reports.

The browser cannot query AWC because it does not permit CORS. This small
collector runs during publication and scheduled refreshes. A failed section
retains the last genuine section with its old retrieval time and a stale flag.
Source: https://aviationweather.gov/data/api/ (verified 2026-11-01).
"""

from __future__ import annotations

import argparse
import base64
from datetime import datetime, timedelta, timezone
import gzip
import io
import json
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen

STATIONS = ("LKCS", "LKHS", "LKPR", "LKKB", "LKPD", "LKTB", "LKKV", "LOWL", "LOWW")
FIRS = ("LKAA", "LOVV", "EDMM", "LZBB")
ROOT = Path(__file__).resolve().parents[1]
USER_AGENT = "heli-briefing/0.2 (+https://github.com/xefensor/heli-briefing)"
MAX_BYTES = 8 * 1024 * 1024
HISTORY_HOURS = 12
HISTORY_LIMIT = 400
RADAR_FRAME_HOURS = 2
RADAR_FRAME_LIMIT = 24
RADAR_IMAGE_MAX_BYTES = 2 * 1024 * 1024
RADAR_DIRECTORY = "https://opendata.chmi.cz/meteorology/weather/radar/composite/pseudocappi2km/png/"
RADAR_DOCUMENTATION = "https://opendata.chmi.cz/meteorology/weather/radar/radar_description_en.pdf"
RADAR_IMAGE_PATTERN = re.compile(re.escape(RADAR_DIRECTORY) + r"pacz2gmaps3\.z_cappi020\.\d{8}\.\d{4}\.0\.png")


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


def history_url():
    # Nine stations x twelve hours remains a bounded regional request. A hit
    # on the documented 400-entry cap is reported, never called full coverage.
    params = urlencode({"ids": ",".join(STATIONS), "format": "json", "hours": HISTORY_HOURS})
    return "https://aviationweather.gov/api/data/metar?" + params


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
                with gzip.GzipFile(fileobj=io.BytesIO(body)) as compressed:
                    body = compressed.read(MAX_BYTES + 1)
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
    collected = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    if collected.tzinfo is None:
        raise FeedError("Radar collection time has no timezone")
    candidates = {}
    for filename, day, clock in matches:
        try:
            observed = datetime.strptime(day + clock, "%Y%m%d%H%M").replace(tzinfo=timezone.utc)
            # Published future-dated names must not become observations or
            # animation frames. Every frame must exist in the actual listing.
            if observed <= collected:
                candidates[observed] = filename
        except ValueError:
            continue
    if not candidates:
        raise FeedError("ČHMÚ directory contains no recognized non-future radar PNG")
    observed = max(candidates)
    filename = candidates[observed]
    cutoff = collected - timedelta(hours=RADAR_FRAME_HOURS)
    frames = [{"url": RADAR_DIRECTORY + candidates[instant], "observedAt": iso_time(instant.timestamp())}
              for instant in sorted(candidates) if cutoff < instant <= collected][-RADAR_FRAME_LIMIT:]
    return {
        "status": "ok",
        "retrievedAt": timestamp,
        "attemptedAt": timestamp,
        "observedAt": iso_time(observed.timestamp()),
        "url": RADAR_DIRECTORY + filename,
        "frames": frames,
        "framesWindowHours": RADAR_FRAME_HOURS,
        "framesFrom": frames[0]["observedAt"] if frames else None,
        "framesTo": frames[-1]["observedAt"] if frames else None,
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
        "observedAt": None, "url": None, "frames": [], "framesWindowHours": RADAR_FRAME_HOURS,
        "framesFrom": None, "framesTo": None, "bounds": None, "legendUrl": None,
        "sourceUrl": RADAR_DIRECTORY, "documentationUrl": RADAR_DOCUMENTATION,
        "error": message,
    }


class RadarRedirectHandler(HTTPRedirectHandler):
    """Do not turn an image capture into an arbitrary URL fetch via redirect."""

    def redirect_request(self, request, response, code, message, headers, newurl):
        if not RADAR_IMAGE_PATTERN.fullmatch(newurl):
            raise FeedError("ČHMÚ radar image redirected outside the allowed product directory")
        return super().redirect_request(request, response, code, message, headers, newurl)


def fetch_radar_image(url, observed_at, timestamp, opener=None):
    """Capture one bounded native PNG for an offline archive, never all frames."""
    if not isinstance(url, str) or not RADAR_IMAGE_PATTERN.fullmatch(url):
        raise FeedError("Radar image URL is not an allowed ČHMÚ product")
    if not iso_time(observed_at):
        raise FeedError("Radar image has no valid observation time")
    filename_time = datetime.strptime(url[len(RADAR_DIRECTORY):], "pacz2gmaps3.z_cappi020.%Y%m%d.%H%M.0.png").replace(tzinfo=timezone.utc)
    if iso_time(filename_time.timestamp()) != iso_time(observed_at):
        raise FeedError("Radar image filename and observation time disagree")
    opener = opener or build_opener(RadarRedirectHandler()).open
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "image/png"})
    try:
        with opener(request, timeout=15) as response:
            if response.geturl() != url:
                raise FeedError("Radar image response URL differs from the requested observation")
            content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
            if content_type != "image/png":
                raise FeedError("ČHMÚ radar image did not return image/png")
            body = response.read(RADAR_IMAGE_MAX_BYTES + 1)
        if len(body) > RADAR_IMAGE_MAX_BYTES:
            raise FeedError("ČHMÚ radar image exceeds the 2 MiB capture limit")
        if len(body) < 24 or body[:8] != b"\x89PNG\r\n\x1a\n" or body[12:16] != b"IHDR":
            raise FeedError("ČHMÚ radar image has no valid PNG signature/header")
    except HTTPError as error:
        raise FeedError(f"ČHMÚ radar image HTTP {error.code}") from error
    except (URLError, TimeoutError, OSError) as error:
        raise FeedError(f"ČHMÚ radar image unavailable ({type(error).__name__})") from error
    return {
        "imageDataUrl": "data:image/png;base64," + base64.b64encode(body).decode("ascii"),
        "imageUrl": url,
        "imageObservedAt": iso_time(observed_at),
        "imageRetrievedAt": timestamp,
        "imageAttemptedAt": timestamp,
        "imageFetchStatus": "ok",
        "imageError": None,
    }


def failed_radar_image(previous, timestamp, message):
    """Retain old bytes with their OLD identity even when a new frame failed."""
    if isinstance(previous, dict) and isinstance(previous.get("imageDataUrl"), str) and previous["imageDataUrl"].startswith("data:image/png;base64,") and previous.get("imageObservedAt"):
        image = {key: value for key, value in previous.items() if key.startswith("image")}
        image.update(imageFetchStatus="stale", imageAttemptedAt=timestamp, imageError=message)
        return image
    return {
        "imageDataUrl": None, "imageUrl": None, "imageObservedAt": None,
        "imageRetrievedAt": None, "imageAttemptedAt": timestamp,
        "imageFetchStatus": "unavailable", "imageError": message,
    }


def deduplicate_metars(items):
    """Keep the last received revision for a station/observation, not duplicates."""
    revisions = {}
    for item in items:
        key = (item["station"], item["observedAt"] or item["raw"] or item["id"])
        rank = (item["receivedAt"] or "", item["corrected"], item["amended"])
        previous = revisions.get(key)
        previous_rank = (previous["receivedAt"] or "", previous["corrected"], previous["amended"]) if previous else None
        if previous is None or rank > previous_rank:
            revisions[key] = item
    return sorted(revisions.values(), key=lambda item: (item["observedAt"] or "", item["station"] or "", item["receivedAt"] or ""))


def latest_metars(items):
    latest = {}
    for item in deduplicate_metars(items):
        station = item["station"]
        rank = (item["observedAt"] or item["receivedAt"] or "", item["receivedAt"] or "", item["corrected"])
        previous = latest.get(station)
        previous_rank = (previous["observedAt"] or previous["receivedAt"] or "", previous["receivedAt"] or "", previous["corrected"]) if previous else None
        if previous is None or rank > previous_rank:
            latest[station] = item
    return [latest[station] for station in STATIONS if station in latest]


def successful_history(rows, timestamp):
    """Retain genuine observations in the requested window with explicit gaps."""
    collected = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    cutoff = iso_time((collected - timedelta(hours=HISTORY_HOURS)).timestamp())
    normalized = [normalize_report("metar", row) for row in rows if row.get("icaoId") in STATIONS]
    future_count = sum(1 for item in normalized if item["observedAt"] and item["observedAt"] > timestamp)
    items = deduplicate_metars([item for item in normalized if item["observedAt"] is None or cutoff <= item["observedAt"] <= timestamp])
    return {
        "history": items,
        "historyStatus": "ok" if items else "empty",
        "historyRetrievedAt": timestamp,
        "historyAttemptedAt": timestamp,
        "historySourceUrl": history_url(),
        "historyHours": HISTORY_HOURS,
        "historyWindowFrom": cutoff,
        "historyWindowTo": timestamp,
        "historyLimitReached": len(rows) >= HISTORY_LIMIT,
        "historyUnknownTimeCount": sum(1 for item in items if item["observedAt"] is None),
        "historyFutureTimeCount": future_count,
        "historyError": None,
    }


def failed_history(previous, timestamp, message):
    if isinstance(previous, dict) and isinstance(previous.get("history"), list) and previous.get("historyRetrievedAt"):
        history = {key: value for key, value in previous.items() if key.startswith("history")}
        history.update(historyStatus="stale", historyAttemptedAt=timestamp, historyError=message)
        return history
    return {
        "history": [], "historyStatus": "unavailable", "historyRetrievedAt": None,
        "historyAttemptedAt": timestamp, "historySourceUrl": history_url(),
        "historyHours": HISTORY_HOURS, "historyWindowFrom": None, "historyWindowTo": None,
        "historyLimitReached": False, "historyUnknownTimeCount": 0,
        "historyFutureTimeCount": 0, "historyError": message,
    }


def successful_section(kind, rows, url, timestamp):
    if kind == "sigmet":
        rows = [row for row in rows if row.get("firId") in FIRS]
    else:
        rows = [row for row in rows if row.get("icaoId") in STATIONS]
    items = [normalize_report(kind, row) for row in rows]
    if kind == "metar":
        items = latest_metars(items)
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


def build_snapshot(previous=None, fetcher=fetch_json, timestamp=None, pause=0.7, radar_fetcher=fetch_radar, image_fetcher=fetch_radar_image):
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
    if pause:
        time.sleep(pause)
    attempted_at = timestamp or utc_now()
    try:
        history_rows = fetcher(history_url())
        snapshot["metar"].update(successful_history(history_rows, timestamp or utc_now()))
    except (FeedError, TimeoutError, OSError, ValueError) as error:
        snapshot["metar"].update(failed_history(previous.get("metar"), attempted_at, str(error)))
    try:
        snapshot["radar"] = radar_fetcher(timestamp or utc_now())
    except (FeedError, TimeoutError, OSError, ValueError) as error:
        snapshot["radar"] = failed_radar(previous.get("radar"), timestamp or utc_now(), str(error))
    radar = snapshot["radar"]
    attempted_at = timestamp or utc_now()
    try:
        if radar.get("status") != "ok" or not radar.get("url"):
            raise FeedError("Current radar metadata is unavailable; no new image captured")
        radar.update(image_fetcher(radar["url"], radar.get("observedAt"), attempted_at))
    except (FeedError, TimeoutError, OSError, ValueError) as error:
        radar.update(failed_radar_image(previous.get("radar"), attempted_at, str(error)))
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
    print(f"METAR history: {snapshot['metar']['historyStatus']}, {len(snapshot['metar']['history'])} report(s), retrieved {snapshot['metar']['historyRetrievedAt']}")
    print(f"radar: {snapshot['radar']['status']}, observed {snapshot['radar']['observedAt']}, {len(snapshot['radar'].get('frames', []))} frame(s)")
    print(f"radar image: {snapshot['radar']['imageFetchStatus']}, observed {snapshot['radar']['imageObservedAt']}")
    # An honest unavailable/stale section is publishable. Only fatal filesystem
    # or programming errors should prevent a site update during an AWC outage.
    return 0


if __name__ == "__main__":
    sys.exit(main())
