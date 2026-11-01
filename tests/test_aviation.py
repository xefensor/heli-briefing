"""Contract tests for source times and failures, independent of live weather."""

import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("aviation", Path(__file__).resolve().parents[1] / "scripts/update_aviation.py")
aviation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(aviation)


class AviationTests(unittest.TestCase):
    def test_missing_values_do_not_become_weather(self):
        original = {"icaoId": "LKCS", "rawOb": "METAR LKCS NIL", "wspd": 0, "temp": None, "obsTime": 0}
        report = aviation.normalize_report("metar", original)
        self.assertEqual(report["observedAt"], "1970-01-01T00:00:00Z")
        self.assertIsNone(report["issuedAt"])
        self.assertTrue(report["nil"])
        self.assertEqual(report["source"]["wspd"], 0)
        self.assertIsNone(report["source"]["temp"])
        self.assertEqual(report["raw"], original["rawOb"])

    def test_taf_crosses_month_without_raw_day_guessing(self):
        original = {"icaoId": "LOWL", "rawTAF": "TAF AMD LOWL 312300Z 0100/0206 CNL", "issueTime": "2026-10-31T23:00:00Z", "validTimeFrom": 1793491200, "validTimeTo": 1793599200}
        report = aviation.normalize_report("taf", original)
        self.assertEqual(report["issuedAt"], "2026-10-31T23:00:00Z")
        self.assertEqual(report["validFrom"], "2026-11-01T00:00:00Z")
        self.assertEqual(report["validTo"], "2026-11-02T06:00:00Z")
        self.assertTrue(report["cancelled"])
        self.assertTrue(report["amended"])

    def test_unknown_timezone_and_bad_times_remain_null(self):
        for value in (None, "not-a-time", "2026-11-01T12:00:00", True, 10**30):
            self.assertIsNone(aviation.iso_time(value))

    def test_failure_retains_retrieval_time_and_real_data(self):
        previous = {"status": "ok", "retrievedAt": "2026-11-01T10:00:00Z", "items": [{"raw": "actual source text"}]}
        failed = aviation.failed_section(previous, "https://example.test", "2026-11-01T11:00:00Z", "AWC HTTP 503")
        self.assertEqual(failed["status"], "stale")
        self.assertEqual(failed["retrievedAt"], previous["retrievedAt"])
        self.assertEqual(failed["items"], previous["items"])
        self.assertEqual(previous["status"], "ok")
        self.assertEqual(failed["attemptedAt"], "2026-11-01T11:00:00Z")

    def test_empty_success_and_failure_are_distinct(self):
        empty = aviation.successful_section("taf", [], "url", "timestamp")
        unavailable = aviation.failed_section({}, "url", "timestamp", "outage")
        self.assertEqual(empty["status"], "empty")
        self.assertEqual(empty["missingStations"], list(aviation.STATIONS))
        self.assertEqual(unavailable["status"], "unavailable")
        self.assertIsNone(unavailable["retrievedAt"])

    def test_sigmet_filter_is_fir_scoped_and_preserves_cancelled(self):
        rows = [
            {"firId": "LKAA", "icaoId": "LKPR", "rawSigmet": "LKAA SIGMET 1 VALID CNL SIGMET 0", "issueTime": "2026-11-01T10:00:00Z"},
            {"firId": "WAAF", "rawSigmet": "distant bulletin"},
        ]
        section = aviation.successful_section("sigmet", rows, "url", "timestamp")
        self.assertEqual(len(section["items"]), 1)
        self.assertTrue(section["items"][0]["cancelled"])
        self.assertEqual(section["firScope"], list(aviation.FIRS))

    def test_snapshot_publishes_section_failures_without_fabrication(self):
        def unavailable(_url):
            raise aviation.FeedError("test outage")
        snapshot = aviation.build_snapshot(fetcher=unavailable, radar_fetcher=unavailable, timestamp="2026-11-01T12:00:00Z", pause=0)
        for kind in ("metar", "taf", "sigmet"):
            self.assertEqual(snapshot[kind]["status"], "unavailable")
            self.assertEqual(snapshot[kind]["items"], [])
        self.assertEqual(snapshot["radar"]["status"], "unavailable")
        self.assertIsNone(snapshot["radar"]["url"])

    def test_radar_uses_source_observation_time_not_collection_time(self):
        listing = '<a href="pacz2gmaps3.z_cappi020.20261031.2355.0.png">old</a><a href="pacz2gmaps3.z_cappi020.20261101.0000.0.png">new</a>'
        result = aviation.radar_from_listing(listing, "2026-11-01T00:09:00Z")
        self.assertEqual(result["observedAt"], "2026-11-01T00:00:00Z")
        self.assertEqual(result["retrievedAt"], "2026-11-01T00:09:00Z")
        self.assertTrue(result["url"].endswith("20261101.0000.0.png"))
        self.assertNotEqual(result["bounds"], result["dataBounds"])

    def test_radar_failure_preserves_old_image_and_source_time(self):
        result = aviation.failed_radar({"url": "https://example.test/old.png", "retrievedAt": "2026-11-01T10:00:00Z", "observedAt": "2026-11-01T09:55:00Z"}, "2026-11-01T11:00:00Z", "outage")
        self.assertEqual(result["status"], "stale")
        self.assertEqual(result["observedAt"], "2026-11-01T09:55:00Z")
        self.assertEqual(result["retrievedAt"], "2026-11-01T10:00:00Z")


if __name__ == "__main__":
    unittest.main()
