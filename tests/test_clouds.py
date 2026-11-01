import importlib.util
from pathlib import Path
import unittest
from datetime import datetime, timezone

SPEC = importlib.util.spec_from_file_location("update_clouds", Path(__file__).resolve().parents[1] / "scripts/update_clouds.py")
clouds = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(clouds)


class CloudTests(unittest.TestCase):
    def test_run_discovery_uses_real_listing_and_rejects_bad_dates(self):
        text = '<a href="2026-11-01T12%3A00/">r</a><a href="2026-11-01T09%3A00/">r</a><a href="2026-02-30T12%3A00/">bad</a><a href="../">up</a>'
        runs = clouds.run_candidates(text)
        self.assertEqual([run.hour for run in runs], [12, 9])
        self.assertEqual(clouds.cache_key(runs[0]), "icon-d2-ceiling-native-v1-2026110112")

    def test_only_exact_whole_hour_steps_are_discovered(self):
        text = ''.join(f'<a href="{name}">x</a>' for name in ['PT000H00M.grib2', 'PT048H00M.grib2', 'PT049H00M.grib2', 'PT001H30M.grib2', '../'])
        self.assertEqual(set(clouds.step_links(text)), {0, 48})

    def test_cropping_preserves_original_native_indices_and_zero(self):
        indices = clouds.selected_indices([48.95, 60, 49.1], [14.4, 14.4, 15.0])
        self.assertEqual(indices, [0, 2])
        self.assertEqual(clouds.selected_values([0, 22, 1234.6], None, indices), [0, 1235])

    def test_bitmap_not_sentinel_number_defines_missing(self):
        self.assertEqual(clouds.selected_values([9999, 9999, float('nan'), 0], [1, 0, 1, 1], [0, 1, 2, 3]), [9999, None, None, 0])

    def test_grid_uuid_and_size_must_match(self):
        a = {'uuid': 'one', 'gridNumber': 47, 'values': [1, 2]}
        clouds.same_grid(a, dict(a))
        with self.assertRaises(ValueError):
            clouds.same_grid(a, {**a, 'uuid': 'other'})
        with self.assertRaises(ValueError):
            clouds.same_grid(a, {**a, 'values': [1]})

    def test_stale_fallback_keeps_real_retrieval_time_and_values(self):
        previous = {'schemaVersion': 1, 'points': [{'lat': 49, 'lon': 14}], 'frames': [{'values': [800]}], 'retrievedAt': 'old', 'runTime': 'run'}
        output = clouds.fallback(previous, RuntimeError('outage'), 'new')
        self.assertEqual(output['status'], 'stale')
        self.assertEqual(output['retrievedAt'], 'old')
        self.assertEqual(output['frames'][0]['values'], [800])
        self.assertEqual(output['attemptedAt'], 'new')

    def test_initial_failure_is_unavailable_never_fake_clear(self):
        output = clouds.fallback(None, RuntimeError('outage'), 'now')
        self.assertEqual(output['status'], 'unavailable')
        self.assertEqual(output['points'], [])
        self.assertIsNone(output['retrievedAt'])

    def test_discovery_chooses_complete_run_not_latest_partial(self):
        latest = datetime(2026, 11, 1, 12, tzinfo=timezone.utc)
        older = datetime(2026, 11, 1, 9, tzinfo=timezone.utc)
        listings = {clouds.RUNS_URL: b'<a href="2026-11-01T12%3A00/">r</a><a href="2026-11-01T09%3A00/">r</a>',
                    clouds.step_directory('CEILING', latest): b'<a href="PT000H00M.grib2">x</a>',
                    clouds.step_directory('CEILING', older): ''.join(f'<a href="PT{i:03d}H00M.grib2">x</a>' for i in range(49)).encode()}
        original = clouds.retrieve
        try:
            clouds.retrieve = lambda url: listings[url]
            selected, urls = clouds.discover_run()
        finally:
            clouds.retrieve = original
        self.assertEqual(selected, older)
        self.assertEqual(len(urls), 49)
        self.assertIn('T09%3A00', urls[48])


if __name__ == '__main__':
    unittest.main()
