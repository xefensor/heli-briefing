#!/usr/bin/env python3
"""Bounded GeoColour snapshot. Fixed WMS product, extent and explicit UTC frame."""
import argparse
import base64
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import struct
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
ENDPOINT='https://view.eumetsat.int/geoserver/wms'
LAYER='mtg_fd:rgb_geocolour'
BOUNDS=[47,10,52,20] # south, west, north, east; WMS 1.3 EPSG:4326 axis order
NS={'w':'http://www.opengis.net/wms'}
PNG=b'\x89PNG\r\n\x1a\n'

def iso(value):
    result=datetime.fromisoformat(value.replace('Z','+00:00'))
    if result.tzinfo is None: raise ValueError('Satellite time has no zone')
    return result.astimezone(timezone.utc)

def frame_time(body,now):
    if b'<!DOCTYPE' in body.upper() or b'<!ENTITY' in body.upper(): raise ValueError('Unexpected XML declaration')
    root=ET.fromstring(body)
    for layer in root.findall('.//w:Layer',NS):
        if layer.findtext('w:Name',namespaces=NS)!=LAYER: continue
        dim=next((d for d in layer.findall('w:Dimension',NS) if d.attrib.get('name')=='time'),None)
        if dim is None: raise ValueError('No product time dimension')
        # Request the explicitly advertised default, never an invented "latest".
        value=iso(dim.attrib.get('default',''))
        if value>now: raise ValueError('Satellite frame is in the future')
        extent=(dim.text or '').strip()
        parts=extent.split('/')
        if len(parts)!=3 or not iso(parts[0])<=value<=iso(parts[1]): raise ValueError('Frame outside published time extent')
        return value.isoformat(timespec='seconds').replace('+00:00','Z')
    raise ValueError('GeoColour product missing from capabilities')

def image_url(time):
    return ENDPOINT+'?'+urlencode({'service':'WMS','request':'GetMap','version':'1.3.0','layers':LAYER,'styles':'','format':'image/png','transparent':'false','crs':'EPSG:4326','bbox':','.join(map(str,BOUNDS)),'width':1000,'height':500,'time':time})

def fetch(url,limit):
    with urlopen(Request(url,headers={'User-Agent':'heli-briefing/0.3 (+https://github.com/xefensor/heli-briefing)'}),timeout=25) as response:
        if urlparse(response.url).hostname!='view.eumetsat.int': raise ValueError('Unexpected provider redirect')
        body=response.read(limit+1)
        if len(body)>limit: raise ValueError('Satellite response exceeds limit')
        return body,response.headers.get_content_type()

def valid_png(body):
    return len(body)>32 and body.startswith(PNG) and body[12:16]==b'IHDR' and struct.unpack('>II',body[16:24])==(1000,500)

def collect(previous=None,now=None,fetcher=fetch):
    now=now or datetime.now(timezone.utc)
    stamp=now.isoformat(timespec='seconds').replace('+00:00','Z')
    base={'schemaVersion':1,'product':'GeoColour RGB','layer':LAYER,'bounds':BOUNDS,'sourceUrl':'https://user.eumetsat.int/catalogue/EO:EUM:DAT:0913','attribution':'Contains modified EUMETSAT Meteosat GeoColour product 2026 · EUMETSAT / NASA · regional WMS crop','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','attemptedAt':stamp}
    try:
        capabilities,_=fetcher(ENDPOINT+'?service=WMS&request=GetCapabilities&version=1.3.0',2_000_000)
        time=frame_time(capabilities,now)
        url=image_url(time)
        # Reuse bytes only for the exact same product/time/extent.
        reused=False
        if previous and previous.get('imageUrl')==url and previous.get('observedAt')==time:
            body=base64.b64decode(previous.get('imageDataUrl','').split(',')[-1],validate=True)
            if not valid_png(body): raise ValueError('Invalid retained image')
            reused=True
        else:
            body,mime=fetcher(url,2_000_000)
            if mime!='image/png' or not valid_png(body): raise ValueError('Provider did not return the expected PNG image')
        return {**base,'status':'ok','observedAt':time,'retrievedAt':previous.get('retrievedAt') if reused else stamp,'checkedAt':stamp,'imageUrl':url,'imageDataUrl':'data:image/png;base64,'+base64.b64encode(body).decode(),'error':None}
    except Exception as error:
        retained=False
        if previous and previous.get('layer')==LAYER and previous.get('bounds')==BOUNDS:
            try:
                retained=iso(previous['observedAt'])<=now and valid_png(base64.b64decode(previous['imageDataUrl'].split(',')[-1],validate=True))
            except (KeyError,ValueError,TypeError): pass
        return {**(previous if retained else base),'attemptedAt':stamp,'status':'stale' if retained else 'unavailable','error':str(error)[:240]}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',default=str(ROOT/'web/data/satellite.json'));args=parser.parse_args()
    output=Path(args.output)
    try: previous=json.loads(output.read_text())
    except (OSError,ValueError): previous=None
    result=collect(previous);output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps({k:result.get(k) for k in ['status','observedAt','retrievedAt','error']}))
if __name__=='__main__':main()
