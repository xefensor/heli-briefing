"""Contract tests for source times and failures, independent of live weather."""

import importlib.util
from datetime import datetime, timedelta, timezone
import base64
import io
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("aviation", Path(__file__).resolve().parents[1] / "scripts/update_aviation.py")
aviation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(aviation)

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Z1kAAAAASUVORK5CYII=")
IMAGE_URL = aviation.RADAR_DIRECTORY + "pacz2gmaps3.z_cappi020.20261101.1200.0.png"


class ImageResponse(io.BytesIO):
    def __init__(self, body, content_type="image/png", url=IMAGE_URL):
        super().__init__(body)
        self.headers = {"Content-Type": content_type}
        self.url = url

    def geturl(self):
        return self.url


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
        self.assertEqual(snapshot["metar"]["historyStatus"], "unavailable")
        self.assertEqual(snapshot["metar"]["history"], [])

    def test_radar_uses_source_observation_time_not_collection_time(self):
        listing = '<a href="pacz2gmaps3.z_cappi020.20261031.2355.0.png">old</a><a href="pacz2gmaps3.z_cappi020.20261101.0000.0.png">new</a>'
        result = aviation.radar_from_listing(listing, "2026-11-01T00:09:00Z")
        self.assertEqual(result["observedAt"], "2026-11-01T00:00:00Z")
        self.assertEqual(result["retrievedAt"], "2026-11-01T00:09:00Z")
        self.assertTrue(result["url"].endswith("20261101.0000.0.png"))
        self.assertNotEqual(result["bounds"], result["dataBounds"])
        self.assertEqual(result["frames"][-1]["observedAt"], result["observedAt"])

    def test_radar_failure_preserves_old_image_and_source_time(self):
        result = aviation.failed_radar({"url": "https://example.test/old.png", "retrievedAt": "2026-11-01T10:00:00Z", "observedAt": "2026-11-01T09:55:00Z"}, "2026-11-01T11:00:00Z", "outage")
        self.assertEqual(result["status"], "stale")
        self.assertEqual(result["observedAt"], "2026-11-01T09:55:00Z")
        self.assertEqual(result["retrievedAt"], "2026-11-01T10:00:00Z")

    def test_latest_metar_deduplication_keeps_received_correction(self):
        rows = [
            {"icaoId": "LKPR", "obsTime": 1793534400, "receiptTime": "2026-11-01T12:02:00Z", "rawOb": "METAR LKPR 011200Z original", "temp": 0},
            {"icaoId": "LKPR", "obsTime": 1793530800, "receiptTime": "2026-11-01T11:02:00Z", "rawOb": "METAR LKPR 011100Z older"},
            {"icaoId": "LKPR", "obsTime": 1793534400, "receiptTime": "2026-11-01T12:04:00Z", "rawOb": "METAR COR LKPR 011200Z corrected", "temp": None},
        ]
        section = aviation.successful_section("metar", rows, "url", "2026-11-01T12:10:00Z")
        self.assertEqual(len(section["items"]), 1)
        self.assertTrue(section["items"][0]["corrected"])
        self.assertIsNone(section["items"][0]["source"]["temp"])

    def test_history_sorts_deduplicates_and_preserves_nil(self):
        rows = [
            {"icaoId": "LKPR", "obsTime": 1793534400, "receiptTime": "2026-11-01T12:02:00Z", "rawOb": "METAR LKPR 011200Z plain"},
            {"icaoId": "LKPR", "obsTime": 1793530800, "rawOb": "METAR LKPR 011100Z NIL"},
            {"icaoId": "LKPR", "obsTime": 1793534400, "receiptTime": "2026-11-01T12:04:00Z", "rawOb": "METAR COR LKPR 011200Z revised"},
            {"icaoId": "UNKN", "obsTime": 1793534400, "rawOb": "not requested"},
        ]
        history = aviation.successful_history(rows, "2026-11-01T12:10:00Z")
        self.assertEqual(len(history["history"]), 2)
        self.assertEqual(history["history"][0]["observedAt"], "2026-11-01T11:00:00Z")
        self.assertTrue(history["history"][0]["nil"])
        self.assertTrue(history["history"][1]["corrected"])
        self.assertEqual(history["historyWindowFrom"], "2026-11-01T00:10:00Z")

    def test_history_window_future_and_unknown_times_are_explicit(self):
        rows = [
            {"icaoId": "LKPR", "obsTime": 1793491200, "rawOb": "too old"},
            {"icaoId": "LKPR", "obsTime": 1793538000, "rawOb": "future"},
            {"icaoId": "LKCS", "rawOb": "METAR LKCS NIL"},
        ]
        history = aviation.successful_history(rows, "2026-11-01T12:10:00Z")
        self.assertEqual(len(history["history"]), 1)
        self.assertIsNone(history["history"][0]["observedAt"])
        self.assertEqual(history["historyUnknownTimeCount"], 1)
        self.assertEqual(history["historyFutureTimeCount"], 1)
        self.assertFalse(history["historyLimitReached"])
        limited = aviation.successful_history([rows[2]] * 400, "2026-11-01T12:10:00Z")
        self.assertTrue(limited["historyLimitReached"])
        self.assertEqual(len(limited["history"]), 1)

    def test_history_failure_does_not_make_fresh_latest_stale(self):
        previous = {"metar": {"status": "ok", "retrievedAt": "2026-11-01T10:00:00Z", "items": [], "history": [{"raw": "old genuine report"}], "historyRetrievedAt": "2026-11-01T10:00:00Z", "historyWindowTo": "2026-11-01T10:00:00Z"}}
        def fetcher(url):
            if "hours=12" in url:
                raise aviation.FeedError("history unavailable")
            return []
        snapshot = aviation.build_snapshot(previous, fetcher=fetcher, radar_fetcher=lambda _time: {"status": "empty"}, timestamp="2026-11-01T12:00:00Z", pause=0)
        metar = snapshot["metar"]
        self.assertEqual(metar["status"], "empty")
        self.assertEqual(metar["retrievedAt"], "2026-11-01T12:00:00Z")
        self.assertEqual(metar["historyStatus"], "stale")
        self.assertEqual(metar["historyRetrievedAt"], "2026-11-01T10:00:00Z")
        self.assertEqual(metar["historyWindowTo"], "2026-11-01T10:00:00Z")
        self.assertEqual(metar["history"], previous["metar"]["history"])

    def test_latest_failure_can_coexist_with_successful_history(self):
        previous = {"metar": {"status": "ok", "retrievedAt": "2026-11-01T10:00:00Z", "items": [{"raw": "old latest"}]}}
        def fetcher(url):
            if "hours=12" in url:
                return [{"icaoId": "LKPR", "obsTime": 1793530800, "rawOb": "METAR LKPR 011100Z NIL"}]
            if "/metar?" in url:
                raise aviation.FeedError("latest unavailable")
            return []
        snapshot = aviation.build_snapshot(previous, fetcher=fetcher, radar_fetcher=lambda _time: {"status": "empty"}, timestamp="2026-11-01T12:00:00Z", pause=0)
        self.assertEqual(snapshot["metar"]["status"], "stale")
        self.assertEqual(snapshot["metar"]["retrievedAt"], "2026-11-01T10:00:00Z")
        self.assertEqual(snapshot["metar"]["historyStatus"], "ok")
        self.assertEqual(snapshot["metar"]["historyRetrievedAt"], "2026-11-01T12:00:00Z")

    def test_radar_frames_use_only_actual_nonfuture_files_and_leave_gaps(self):
        start = datetime(2026, 11, 1, 12, 0, tzinfo=timezone.utc)
        names = []
        for index in range(26):
            instant = start + timedelta(minutes=5 * index)
            if instant.hour == 13 and instant.minute == 0:
                continue
            name = "pacz2gmaps3.z_cappi020." + instant.strftime("%Y%m%d.%H%M") + ".0.png"
            names.append(f'<a href="{name}">actual file</a>')
        radar = aviation.radar_from_listing("".join(reversed(names)), "2026-11-01T14:00:00Z")
        self.assertEqual(len(radar["frames"]), 23)
        times = [frame["observedAt"] for frame in radar["frames"]]
        self.assertEqual(times, sorted(times))
        self.assertEqual(times[0], "2026-11-01T12:05:00Z")
        self.assertEqual(times[-1], "2026-11-01T14:00:00Z")
        self.assertNotIn("2026-11-01T13:00:00Z", times)
        self.assertNotIn("2026-11-01T14:05:00Z", times)
        self.assertEqual(radar["frames"][-1]["url"], radar["url"])

    def test_radar_with_only_future_files_fails_instead_of_inventing_now(self):
        with self.assertRaises(aviation.FeedError):
            aviation.radar_from_listing('<a href="pacz2gmaps3.z_cappi020.20261101.1500.0.png">future</a>', "2026-11-01T14:00:00Z")

    def test_current_radar_image_is_captured_with_its_exact_identity(self):
        result = aviation.fetch_radar_image(IMAGE_URL, "2026-11-01T12:00:00Z", "2026-11-01T12:03:00Z", opener=lambda *_args, **_kwargs: ImageResponse(PNG))
        self.assertEqual(result["imageFetchStatus"], "ok")
        self.assertEqual(result["imageObservedAt"], "2026-11-01T12:00:00Z")
        self.assertEqual(result["imageUrl"], IMAGE_URL)
        self.assertEqual(base64.b64decode(result["imageDataUrl"].split(",", 1)[1]), PNG)

    def test_radar_image_rejects_wrong_type_signature_size_and_response_url(self):
        responses = [
            lambda: ImageResponse(PNG, content_type="text/html"),
            lambda: ImageResponse(b"not a PNG despite its content type"),
            lambda: ImageResponse(PNG + b"x" * aviation.RADAR_IMAGE_MAX_BYTES),
            lambda: ImageResponse(PNG, url=aviation.RADAR_DIRECTORY + "pacz2gmaps3.z_cappi020.20261101.1205.0.png"),
        ]
        for response in responses:
            with self.subTest(response=response), self.assertRaises(aviation.FeedError):
                aviation.fetch_radar_image(IMAGE_URL, "2026-11-01T12:00:00Z", "2026-11-01T12:03:00Z", opener=lambda *_args, **_kwargs: response())

    def test_radar_image_rejects_arbitrary_url_and_mislabeled_observation_before_fetch(self):
        def forbidden(*_args, **_kwargs):
            self.fail("An invalid capture must never perform a request")
        with self.assertRaises(aviation.FeedError):
            aviation.fetch_radar_image("https://example.test/image.png", "2026-11-01T12:00:00Z", "now", opener=forbidden)
        with self.assertRaises(aviation.FeedError):
            aviation.fetch_radar_image(IMAGE_URL, "2026-11-01T12:05:00Z", "now", opener=forbidden)

    def test_failed_new_image_retains_old_bytes_with_old_time_only(self):
        previous = aviation.fetch_radar_image(IMAGE_URL, "2026-11-01T12:00:00Z", "2026-11-01T12:03:00Z", opener=lambda *_args, **_kwargs: ImageResponse(PNG))
        old_radar = {"url": IMAGE_URL, "observedAt": "2026-11-01T12:00:00Z", **previous}
        def failed_image(*_args):
            raise aviation.FeedError("new frame download failed")
        snapshot = aviation.build_snapshot({"radar": old_radar}, fetcher=lambda _url: [], radar_fetcher=lambda _time: {"status": "ok", "url": aviation.RADAR_DIRECTORY + "pacz2gmaps3.z_cappi020.20261101.1205.0.png", "observedAt": "2026-11-01T12:05:00Z"}, image_fetcher=failed_image, timestamp="2026-11-01T12:08:00Z", pause=0)
        radar = snapshot["radar"]
        self.assertEqual(radar["status"], "ok")
        self.assertEqual(radar["imageFetchStatus"], "stale")
        self.assertEqual(radar["imageDataUrl"], previous["imageDataUrl"])
        self.assertEqual(radar["imageObservedAt"], "2026-11-01T12:00:00Z")
        self.assertNotEqual(radar["imageObservedAt"], radar["observedAt"])
        self.assertEqual(radar["imageRetrievedAt"], "2026-11-01T12:03:00Z")
        self.assertEqual(radar["imageAttemptedAt"], "2026-11-01T12:08:00Z")


if __name__ == "__main__":
    unittest.main()
