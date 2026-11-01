import importlib.util
from pathlib import Path
import unittest
from datetime import datetime,timezone
import struct
spec=importlib.util.spec_from_file_location('satellite',Path(__file__).parents[1]/'scripts/update_satellite.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
NOW=datetime(2026,11,1,15,tzinfo=timezone.utc)
XML=b'<WMS_Capabilities xmlns="http://www.opengis.net/wms"><Capability><Layer><Layer><Name>mtg_fd:rgb_geocolour</Name><Dimension name="time" default="2026-11-01T14:40:00Z">2026-11-01T00:00:00Z/2026-11-01T14:40:00Z/PT10M</Dimension></Layer></Layer></Capability></WMS_Capabilities>'
PNG=s.PNG+b'\x00\x00\x00\x0dIHDR'+struct.pack('>II',1000,500)+bytes(20)
def fetch(url,limit):return (XML,'text/xml') if 'Capabilities' in url else (PNG,'image/png')
class SatelliteTests(unittest.TestCase):
 def test_time_and_axis_order(self):
  time=s.frame_time(XML,NOW);self.assertEqual(time,'2026-11-01T14:40:00Z');url=s.image_url(time);self.assertIn('bbox=47%2C10%2C52%2C20',url);self.assertIn('crs=EPSG%3A4326',url);self.assertIn('14%3A40',url)
 def test_future_and_xml_entities_rejected(self):
  with self.assertRaises(ValueError):s.frame_time(XML.replace(b'2026-11-01T14:40',b'2026-11-02T14:40'),NOW)
  with self.assertRaises(ValueError):s.frame_time(b'<!DOCTYPE x>'+XML,NOW)
 def test_bad_image_and_missing_product_are_unavailable(self):
  self.assertEqual(s.collect(now=NOW,fetcher=lambda url,limit:(XML,'text/xml') if 'Capabilities' in url else (b'<html>error</html>','text/html'))['status'],'unavailable')
  with self.assertRaises(ValueError):s.frame_time(XML.replace(b'mtg_fd:rgb_geocolour',b'other'),NOW)
 def test_failure_retains_real_image_original_time(self):
  old=s.collect(now=NOW,fetcher=fetch)
  def fail(url,limit):raise OSError('offline')
  result=s.collect(old,now=NOW,fetcher=fail);self.assertEqual(result['status'],'stale');self.assertEqual(result['observedAt'],old['observedAt']);self.assertEqual(result['imageDataUrl'],old['imageDataUrl'])
 def test_same_frame_reuses_bytes_without_relabelling_image_retrieval(self):
  old=s.collect(now=NOW,fetcher=fetch)
  def only_metadata(url,limit):
   self.assertIn('Capabilities',url);return XML,'text/xml'
  later=datetime(2026,11,1,15,20,tzinfo=timezone.utc);result=s.collect(old,now=later,fetcher=only_metadata)
  self.assertEqual(result['status'],'ok');self.assertEqual(result['retrievedAt'],old['retrievedAt']);self.assertNotEqual(result['checkedAt'],old['checkedAt'])
if __name__=='__main__':unittest.main()
