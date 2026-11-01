#!/usr/bin/env python3
"""Bounded snapshots of three verified ČHMÚ-authored weather cameras."""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
import json
from pathlib import Path
import re
import struct
from urllib.request import Request, urlopen
from urllib.parse import urlparse, unquote

BASE = 'https://data-provider.chmi.cz'
PAGE = 'https://www.chmi.cz/namerena-data/webkamery'
LICENCE = 'https://www.chmi.cz/vylou%C4%8Den%C3%AD-odpov%C4%9Bdnosti'
CAMERAS = [
    {'id': 'ceske_budejovice', 'name': 'České Budějovice', 'direction': 'Z', 'lat': 48.952085, 'lon': 14.46982},
    {'id': 'churanov', 'name': 'Churáňov', 'direction': 'SV', 'lat': 49.068229, 'lon': 13.614786},
    {'id': 'kocelovice', 'name': 'Kocelovice', 'direction': 'S–SZ', 'lat': 49.467246, 'lon': 13.837805},
]

def stamp(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z', value):
        raise ValueError('Frame time is not UTC ISO')
    return datetime.fromisoformat(value.replace('Z', '+00:00'))

def fetch_json(url):
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.netloc != 'data-provider.chmi.cz':
        raise ValueError('Unexpected camera host')
    req = Request(url, headers={'User-Agent': 'Heli-Briefing-evaluation/0.3 (+https://github.com/xefensor/heli-briefing)', 'Accept': 'application/json'})
    with urlopen(req, timeout=18) as response:
        raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError('Camera response too large')
    return json.loads(raw)

def jpeg_dimensions(data):
    if not data.startswith(b'\xff\xd8\xff') or not data.endswith(b'\xff\xd9'):
        raise ValueError('Invalid JPEG')
    index = 2
    while index + 4 < len(data):
        if data[index] != 255:
            raise ValueError('Invalid JPEG marker')
        while data[index] == 255:
            index += 1
        marker = data[index]; index += 1
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            continue
        length = int.from_bytes(data[index:index + 2], 'big')
        if length < 2 or index + length > len(data):
            raise ValueError('Truncated JPEG')
        if marker in (0xC0, 0xC1, 0xC2):
            height, width = struct.unpack('>HH', data[index + 3:index + 7])
            if not 100 <= width <= 4096 or not 100 <= height <= 4096:
                raise ValueError('Unexpected camera dimensions')
            return width, height
        index += length
    raise ValueError('JPEG dimensions missing')

def decode_image(payload):
    image = payload.get('image')
    if not isinstance(image, str) or not image.startswith('image/jpeg;base64,'):
        raise ValueError('Unexpected camera image type')
    encoded = image.split(',', 1)[1]
    if len(encoded) > 900_000:
        raise ValueError('Camera image too large')
    raw = base64.b64decode(encoded, validate=True)
    if len(raw) > 650_000:
        raise ValueError('Camera image too large')
    width, height = jpeg_dimensions(raw)
    return 'data:image/jpeg;base64,' + encoded, width, height

def collect_camera(camera, previous, now, fetcher=fetch_json):
    timeline_url = f"{BASE}/api/playableImages/init/web-kamery/{camera['id']}"
    try:
        timeline = fetcher(timeline_url)
        frames = []
        for frame in timeline.get('data', []):
            try:
                at = stamp(frame.get('dateTime'))
                if at <= now + timedelta(minutes=5):
                    frames.append((at, frame))
            except (TypeError, ValueError):
                continue
        if not frames:
            raise ValueError('No timestamped camera frame')
        _, frame = max(frames, key=lambda item: item[0])
        url = frame['imageUrl']
        if not url.startswith(f"{BASE}/api/kamery/data/obrazok/{camera['id']}/"):
            raise ValueError('Unexpected camera frame URL')
        parsed = urlparse(url)
        if parsed.query or parsed.fragment or stamp(unquote(parsed.path.rsplit('/', 1)[-1])) != stamp(frame['dateTime']):
            raise ValueError('Camera frame URL/time mismatch')
        if previous and previous.get('observedAt') == frame['dateTime'] and previous.get('imageDataUrl', '').startswith('data:image/jpeg;base64,'):
            return {**previous, 'status': 'ok', 'error': None, 'checkedAt': now.isoformat()}
        image, width, height = decode_image(fetcher(url))
        return {**camera, 'status': 'ok', 'observedAt': frame['dateTime'], 'retrievedAt': now.isoformat(), 'checkedAt': now.isoformat(), 'timeMeaning': 'Čas rámce inzerovaný časovou osou ČHMÚ; nikoli EXIF.', 'sourceUrl': url, 'timelineUrl': timeline_url, 'pageUrl': PAGE, 'imageDataUrl': image, 'width': width, 'height': height, 'attribution': 'ČHMÚ · CC BY 4.0', 'licenceUrl': LICENCE, 'error': None}
    except Exception as error:
        message = f'{type(error).__name__}: kamera nebyla obnovena'
        if previous and previous.get('id') == camera['id'] and previous.get('imageDataUrl', '').startswith('data:image/jpeg;base64,'):
            return {**previous, 'status': 'stale', 'checkedAt': now.isoformat(), 'error': message}
        return {**camera, 'status': 'unavailable', 'observedAt': None, 'retrievedAt': None, 'imageDataUrl': None, 'pageUrl': PAGE, 'attribution': 'ČHMÚ · CC BY 4.0', 'licenceUrl': LICENCE, 'error': message}

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--output', required=True); parser.add_argument('--cache-dir'); args = parser.parse_args()
    now = datetime.now(timezone.utc)
    cache = Path(args.cache_dir) / 'cameras.json' if args.cache_dir else None
    previous = {}
    if cache and cache.exists():
        try:
            data = json.loads(cache.read_text()); previous = {item['id']: item for item in data.get('items', []) if item.get('id') in {camera['id'] for camera in CAMERAS}}
        except (ValueError, KeyError):
            pass
    with ThreadPoolExecutor(max_workers=2) as pool:
        items = list(pool.map(lambda camera: collect_camera(camera, previous.get(camera['id']), now), CAMERAS))
    output = {'schemaVersion': 1, 'retrievedAt': now.isoformat(), 'status': 'ok' if all(item['status'] == 'ok' for item in items) else 'partial', 'items': items}
    path = Path(args.output); path.parent.mkdir(parents=True, exist_ok=True); path.write_text(json.dumps(output, ensure_ascii=False))
    if cache and any(item.get('imageDataUrl') for item in items):
        cache.parent.mkdir(parents=True, exist_ok=True); cache.write_text(json.dumps(output, ensure_ascii=False))
    print(f"Camera snapshot: {sum(bool(item.get('imageDataUrl')) for item in items)} / {len(items)} images")

if __name__ == '__main__':
    main()
