import base64
from datetime import datetime, timezone
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import update_cameras as cameras
import update_charts as charts
NOW = datetime(2026, 11, 1, 12, 0, tzinfo=timezone.utc)
JPEG = b'\xff\xd8\xff\xc0' + struct.pack('>HBHHB', 17, 8, 120, 160, 3) + bytes(9) + b'\xff\xd9'
PNG = b'\x89PNG\r\n\x1a\n' + struct.pack('>I', 13) + b'IHDR' + struct.pack('>II', 200, 100) + bytes(9) + b'\x00\x00\x00\x00IEND\xaeB\x60\x82'
CAMERA = cameras.CAMERAS[0]
AT = '2026-11-01T12:00:00Z'
URL = cameras.BASE + '/api/kamery/data/obrazok/' + CAMERA['id'] + '/' + AT

def frame(at=AT, url=URL):
    return {'dateTime': at, 'imageUrl': url}

def camera_fetch(timeline=None):
    return lambda url: {'data': timeline if timeline is not None else [frame()]} if 'playableImages' in url else {'image': 'image/jpeg;base64,' + base64.b64encode(JPEG).decode()}

class CameraTests(unittest.TestCase):
    def test_image_dimensions_and_reject_wrong_type_or_truncated(self):
        self.assertEqual(cameras.jpeg_dimensions(JPEG), (160, 120))
        for raw in [JPEG[:-2], b'GIF89a', b'\xff\xd8\xff']:
            with self.assertRaises((ValueError, IndexError)):
                cameras.jpeg_dimensions(raw)
        with self.assertRaises(ValueError):
            cameras.decode_image({'image': 'image/svg+xml;base64,PHN2Zz4='})

    def test_real_slot_time_survives_cache_and_failed_refresh(self):
        data = cameras.collect_camera(CAMERA, None, NOW, camera_fetch())
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['observedAt'], AT)
        later = datetime(2026, 11, 1, 12, 20, tzinfo=timezone.utc)
        cached = cameras.collect_camera(CAMERA, data, later, lambda url: {'data': [frame()]})
        self.assertEqual(cached['retrievedAt'], data['retrievedAt'])
        failed = cameras.collect_camera(CAMERA, data, later, lambda url: (_ for _ in ()).throw(TimeoutError()))
        self.assertEqual(failed['status'], 'stale')
        self.assertEqual(failed['observedAt'], AT)
        self.assertEqual(failed['retrievedAt'], data['retrievedAt'])

    def test_future_wrong_host_or_mismatched_image_times_never_become_live(self):
        cases = [[frame('2026-11-02T12:00:00Z')], [frame(url='https://example.com/frame')], [frame(url=URL.replace('12:00:00', '11:50:00'))]]
        for timeline in cases:
            data = cameras.collect_camera(CAMERA, None, NOW, camera_fetch(timeline))
            self.assertEqual(data['status'], 'unavailable')
            self.assertIsNone(data['imageDataUrl'])

class ChartTests(unittest.TestCase):
    def meta(self, sent=AT):
        return {'sent': sent, 'data': [{'displayText': 'RMK: VALID FROM 01.11.2026 10:00 TILL 01.11.2026 16:00'}]}
    def image(self, issue='1. 11. 2026 12:00 UTC'):
        return {'description': 'Datum a čas vystavení: ' + issue, 'content': base64.b64encode(PNG).decode()}
    def config(self):
        return {'boundingBoxes': [{'id':'bb','xmin':10.5,'ymin':47.766666666667,'xmax':20.316666666667,'ymax':51.366666666667}], 'layers': [{'id':'oblacnost','projection':'EPSG:3857','boundingBox':'bb','dataRefBase':cameras.BASE+'/api/data/letectvi/img-forecast/oblacnost/', 'dataParts':[{'dataRef':'202611011200'}, {'dataRef':'202611011500'}]}]}
    def test_swl_binds_stable_issue_and_interval_to_hashed_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            data=charts.collect_swl(Path(directory), NOW, lambda url: self.image() if url==charts.SWL_IMAGE else self.meta())
            self.assertEqual(data['issuedAt'], AT)
            self.assertEqual(data['validFrom'], '2026-11-01T10:00:00+00:00')
            self.assertEqual(data['width'], 200)
            self.assertEqual((Path(directory)/Path(data['imagePath']).name).read_bytes(), PNG)
    def test_swl_mismatch_race_and_future_are_rejected(self):
        for image, times in [(self.image('1. 11. 2026 11:00 UTC'),[AT,AT]), (self.image(),[AT,'2026-11-01T12:01:00Z']), (self.image('2. 11. 2026 12:00 UTC'),['2026-11-02T12:00:00Z']*2)]:
            sequence=iter(times)
            with tempfile.TemporaryDirectory() as directory, self.assertRaises(ValueError):
                charts.collect_swl(Path(directory), NOW, lambda url: image if url==charts.SWL_IMAGE else self.meta(next(sequence)))
    def test_png_truncation_and_wrong_type_rejected(self):
        for image in [PNG[:-8], b'GIF89a', b'<svg/>']:
            with self.assertRaises(ValueError):
                charts.png(base64.b64encode(image).decode())
    def test_low_cloud_missing_frame_preserved_and_issue_never_invented(self):
        def fetch(url):
            if url==charts.LOW_CONFIG: return self.config()
            if url.endswith('1500'): raise TimeoutError()
            return {'img':'data:image/png;base64,'+base64.b64encode(PNG).decode()}
        with tempfile.TemporaryDirectory() as directory:
            data=charts.collect_low(Path(directory),NOW,fetch)
            self.assertEqual(len(data['frames']),2)
            self.assertEqual(data['status'],'partial')
            self.assertIsNone(data['issuedAt'])
            self.assertEqual(data['frames'][1]['status'],'unavailable')
            self.assertIsNone(data['frames'][1]['imagePath'])
    def test_changed_projection_or_bounds_cannot_be_reused_as_current_geometry(self):
        for key in ['projection','bounds']:
            config=self.config()
            if key=='projection': config['layers'][0]['projection']='EPSG:4326'
            else: config['boundingBoxes'][0]['xmin']=11
            with tempfile.TemporaryDirectory() as directory, self.assertRaises(ValueError):
                charts.collect_low(Path(directory),NOW,lambda url:config)

if __name__ == '__main__': unittest.main()
