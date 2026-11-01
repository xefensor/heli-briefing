#!/usr/bin/env python3
"""Collect licensed ČHMÚ SWL and valid-time low-cloud images without inventing issuance."""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct
from update_cameras import fetch_json, BASE, LICENCE, stamp

SWL_META = BASE + '/api/data/txtf/letectvi.cr-swl/'
SWL_IMAGE = BASE + '/api/image/data/predpovedi.cr.swl/'
LOW_CONFIG = BASE + '/api/map/init/letectvi-cz.Oblacnost'

def png(payload):
    if not isinstance(payload, str):
        raise ValueError('PNG missing')
    encoded = payload.split(',', 1)[1] if payload.startswith('data:image/png;base64,') else payload
    raw = base64.b64decode(encoded, validate=True)
    if len(raw) < 45 or len(raw) > 2_000_000 or not raw.startswith(b'\x89PNG\r\n\x1a\n') or raw[12:16] != b'IHDR' or not raw.endswith(b'\x00\x00\x00\x00IEND\xaeB\x60\x82'):
        raise ValueError('Invalid/big PNG')
    width, height = struct.unpack('>II', raw[16:24])
    if width < 100 or height < 100 or width > 4096 or height > 4096:
        raise ValueError('Unexpected chart dimensions')
    return raw, width, height

def write_image(raw, width, height, prefix, directory):
    name = prefix + '-' + hashlib.sha256(raw).hexdigest()[:12] + '.png'
    (directory / name).write_bytes(raw)
    return {'imagePath': './data/charts/' + name, 'width': width, 'height': height}

def collect_swl(directory, now, fetcher=fetch_json):
    before = fetcher(SWL_META); image = fetcher(SWL_IMAGE); after = fetcher(SWL_META)
    if before.get('sent') != after.get('sent'):
        raise ValueError('SWL changed while collecting')
    issued = stamp(before['sent'])
    if issued > now + timedelta(minutes=5):
        raise ValueError('SWL issue lies in the future')
    description = image.get('description', '')
    date = re.search(r'(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+(\d{2}):(\d{2})\s*UTC', description)
    if not date:
        raise ValueError('SWL image issue missing')
    day, month, year, hour, minute = map(int, date.groups())
    if issued.replace(second=0, microsecond=0) != datetime(year, month, day, hour, minute, tzinfo=timezone.utc):
        raise ValueError('SWL metadata/image issue mismatch')
    text = ' '.join(item.get('displayText', '') for item in before.get('data', []))
    period = re.search(r'VALID FROM\s+(\d\d\.\d\d\.\d{4}\s+\d\d:\d\d)\s+TILL\s+(\d\d\.\d\d\.\d{4}\s+\d\d:\d\d)', text)
    if not period:
        raise ValueError('SWL validity unavailable')
    start, end = [datetime.strptime(value, '%d.%m.%Y %H:%M').replace(tzinfo=timezone.utc) for value in period.groups()]
    if end <= start:
        raise ValueError('SWL reversed validity')
    raw, width, height = png(image.get('content'))
    return {'status': 'ok', 'issuedAt': before['sent'], 'validFrom': start.isoformat(), 'validTo': end.isoformat(), 'retrievedAt': now.isoformat(), 'sourceUrl': 'https://www.chmi.cz/letectvi/predpovedi-pro-letani/swl-mapa', 'metadataUrl': SWL_META, 'licenceUrl': LICENCE, **write_image(raw, width, height, 'swl-' + issued.strftime('%Y%m%d%H%M'), directory)}

def collect_low(directory, now, fetcher=fetch_json):
    config = fetcher(LOW_CONFIG)
    layer = next(item for item in config['layers'] if item.get('id') == 'oblacnost')
    expected = BASE + '/api/data/letectvi/img-forecast/oblacnost/'
    if layer.get('dataRefBase') != expected or layer.get('projection') != 'EPSG:3857':
        raise ValueError('Unexpected low-cloud layer')
    bounds = next((item for item in config.get('boundingBoxes', []) if item.get('id') == layer.get('boundingBox')), None)
    expected_bounds = [10.5, 47.766666666667, 20.316666666667, 51.366666666667]
    if not bounds or any(abs(bounds.get(key, 0) - value) > 1e-8 for key, value in zip(['xmin', 'ymin', 'xmax', 'ymax'], expected_bounds)):
        raise ValueError('Low-cloud geographic bounds changed')
    refs = [item.get('dataRef', '') for item in layer.get('dataParts', [])]
    if not refs or any(not re.fullmatch(r'\d{12}', ref) for ref in refs) or len(refs) > 32 or len(set(refs)) != len(refs):
        raise ValueError('Invalid low-cloud time inventory')
    def frame(ref):
        valid = datetime.strptime(ref, '%Y%m%d%H%M').replace(tzinfo=timezone.utc)
        try:
            raw, width, height = png(fetcher(expected + ref).get('img'))
            return {'status': 'ok', 'validAt': valid.isoformat(), 'issuedAt': None, 'retrievedAt': now.isoformat(), 'sourceUrl': expected + ref, **write_image(raw, width, height, 'lowcloud-' + ref, directory)}
        except Exception:
            return {'status': 'unavailable', 'validAt': valid.isoformat(), 'issuedAt': None, 'retrievedAt': None, 'imagePath': None, 'error': 'Snímek nebyl úspěšně načten.'}
    with ThreadPoolExecutor(max_workers=2) as pool:
        frames = list(pool.map(frame, sorted(refs)))
    return {'status': 'ok' if all(item['status'] == 'ok' for item in frames) else 'partial', 'frames': frames, 'issuedAt': None, 'retrievedAt': now.isoformat(), 'sourceUrl': 'https://www.chmi.cz/letectvi/predpovedi-pro-letani/predpoved-nizke-oblacnosti', 'licenceUrl': LICENCE, 'bounds': [10.5, 47.766666666667, 20.316666666667, 51.366666666667], 'projection': 'EPSG:3857'}

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--output', required=True); parser.add_argument('--cache-dir'); args = parser.parse_args()
    output = Path(args.output); output.parent.mkdir(parents=True, exist_ok=True); directory = output.parent / 'charts'; directory.mkdir(exist_ok=True)
    cache = Path(args.cache_dir) if args.cache_dir else None
    previous = {}
    if cache and (cache / 'charts.json').exists():
        try:
            previous = json.loads((cache / 'charts.json').read_text())
            for old in (cache / 'images').glob('*.png'):
                shutil.copyfile(old, directory / old.name)
        except (OSError, ValueError):
            pass
    now = datetime.now(timezone.utc); data = {'schemaVersion': 1, 'checkedAt': now.isoformat()}
    for key, collect in [('swl', collect_swl), ('lowCloud', collect_low)]:
        try:
            data[key] = collect(directory, now)
        except Exception as error:
            data[key] = {**previous[key], 'status': 'stale', 'error': f'{type(error).__name__}: obnova produktu selhala'} if key in previous else {'status': 'unavailable', 'error': f'{type(error).__name__}: produkt nebyl načten'}
    used = {Path(item['imagePath']).name for item in [data['swl'], *data.get('lowCloud', {}).get('frames', [])] if item.get('imagePath')}
    for image in directory.glob('*.png'):
        if image.name not in used:
            image.unlink()
    output.write_text(json.dumps(data, ensure_ascii=False))
    if cache:
        cache.mkdir(parents=True, exist_ok=True); (cache / 'charts.json').write_text(json.dumps(data, ensure_ascii=False))
        image_cache = cache / 'images'; image_cache.mkdir(exist_ok=True)
        for image in image_cache.glob('*.png'):
            if image.name not in used:
                image.unlink()
        for image in directory.glob('*.png'):
            shutil.copyfile(image, image_cache / image.name)
    print(f"Chart snapshot: {len(used)} validated images")

if __name__ == '__main__':
    main()
