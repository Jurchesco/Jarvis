from __future__ import annotations

import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import patch
from zoneinfo import ZoneInfo

from jarvis_import.importers import ImportContext
from jarvis_import.importers import wydolnosc
from jarvis_import.importers.wydolnosc import (
    HEADERS,
    LAST_COLUMN,
    NOTE_COLUMN,
    build_row,
    first_device_value,
    first_dict,
    format_seconds,
    import_wydolnosc,
    status_phrase_to_pl,
)
from jarvis_import.sort_sheets import WORKSHEET_SORT

WARSAW = ZoneInfo("Europe/Warsaw")
DAY = "2026-04-16"


# --- Fixtures based on real python-garminconnect response shapes ---

def sample_max_metrics():
    return [
        {
            "generic": {"vo2MaxPreciseValue": 48.6, "vo2MaxValue": 49.0, "fitnessAge": None},
            "cycling": None,
            "heatAltitudeAcclimation": {"acclimationPercentage": 50, "heatAcclimationPercentage": 0},
        }
    ]


def sample_training_status():
    return {
        "mostRecentVO2Max": {
            "generic": {"vo2MaxPreciseValue": 48.6, "vo2MaxValue": 49.0},
            "cycling": None,
        },
        "mostRecentTrainingLoadBalance": {
            "metricsTrainingLoadBalanceDTOMap": {
                "3501411686": {
                    "monthlyLoadAerobicLow": 494,
                    "monthlyLoadAerobicHigh": 212,
                    "monthlyLoadAnaerobic": 0,
                    "trainingBalanceFeedbackPhrase": "AEROBIC_HIGH_SHORTAGE",
                }
            }
        },
        "mostRecentTrainingStatus": {
            "latestTrainingStatusData": {
                "3501411686": {
                    "weeklyTrainingLoad": None,
                    "trainingStatus": 4,
                    "loadTunnelMin": None,
                    "loadTunnelMax": None,
                    "trainingStatusFeedbackPhrase": "MAINTAINING_2",
                    "acuteTrainingLoadDTO": {
                        "acwrStatus": "OPTIMAL",
                        "dailyTrainingLoadAcute": 670,
                        "dailyTrainingLoadChronic": 528,
                        "dailyAcuteChronicWorkloadRatio": 1.2,
                    },
                    "primaryTrainingDevice": True,
                }
            }
        },
    }


def sample_training_readiness():
    return [
        {
            "level": "MODERATE",
            "feedbackShort": "LISTEN_TO_YOUR_BODY",
            "score": 51,
            "sleepScore": 71,
            "recoveryTime": 1728,
            "acuteLoad": 670,
            "hrvWeeklyAverage": 49,
        }
    ]


class HelperTests(unittest.TestCase):
    def test_format_seconds(self):
        self.assertEqual(format_seconds(1413), "23:33")
        self.assertEqual(format_seconds(3013), "50:13")
        self.assertEqual(format_seconds(6846), "1:54:06")
        self.assertEqual(format_seconds(15322), "4:15:22")
        self.assertEqual(format_seconds(None), "")
        self.assertEqual(format_seconds(0), "")

    def test_status_phrase_to_pl(self):
        self.assertEqual(status_phrase_to_pl("MAINTAINING_2"), "Utrzymanie")
        self.assertEqual(status_phrase_to_pl("PRODUCTIVE_1"), "Produktywny")
        self.assertEqual(status_phrase_to_pl("NO_STATUS"), "Brak statusu")
        self.assertEqual(status_phrase_to_pl("SOMETHING_NEW_9"), "SOMETHING_NEW_9")
        self.assertEqual(status_phrase_to_pl(None), "")

    def test_first_dict(self):
        self.assertEqual(first_dict([{"a": 1}, {"b": 2}]), {"a": 1})
        self.assertEqual(first_dict({"a": 1}), {"a": 1})
        self.assertEqual(first_dict([]), {})
        self.assertEqual(first_dict(None), {})

    def test_first_device_value_prefers_primary(self):
        mapping = {
            "111": {"trainingStatusFeedbackPhrase": "RECOVERY_1"},
            "222": {"trainingStatusFeedbackPhrase": "MAINTAINING_2", "primaryTrainingDevice": True},
        }
        self.assertEqual(first_device_value(mapping)["trainingStatusFeedbackPhrase"], "MAINTAINING_2")

    def test_first_device_value_falls_back_to_first(self):
        mapping = {"111": {"weeklyTrainingLoad": 300}}
        self.assertEqual(first_device_value(mapping)["weeklyTrainingLoad"], 300)
        self.assertEqual(first_device_value(None), {})


class BuildRowTests(unittest.TestCase):
    def _full_row(self):
        return build_row(
            DAY,
            max_metrics=sample_max_metrics(),
            training_status=sample_training_status(),
            training_readiness=sample_training_readiness(),
            endurance={"enduranceScoreDTO": {"overallScore": 5853}},
            hill={"overallScore": 38},
            race={"time5K": 1413, "time10K": 3013, "timeHalfMarathon": 6846, "timeMarathon": 15322},
            fitnessage={"biologicalAge": 27.4, "chronologicalAge": 30},
            existing_note="moja notatka",
            tz=WARSAW,
        )

    def test_row_length_matches_headers(self):
        self.assertEqual(len(self._full_row()), len(HEADERS))
        self.assertEqual(NOTE_COLUMN, len(HEADERS) - 1)

    def test_full_extraction(self):
        row = self._full_row()
        self.assertTrue(row[0].startswith(DAY))
        self.assertEqual(row[1], 48.6)          # VO2max bieg
        self.assertEqual(row[2], "")            # VO2max kolarstwo (None)
        self.assertEqual(row[3], 27.4)          # wiek sprawnościowy (biologicalAge)
        self.assertEqual(row[4], "Utrzymanie")  # status PL
        self.assertEqual(row[5], "MAINTAINING_2")
        self.assertEqual(row[6], "")            # weekly load None
        self.assertEqual(row[9], 670)           # acute
        self.assertEqual(row[10], 528)          # chronic
        self.assertEqual(row[11], 1.2)          # ACWR
        self.assertEqual(row[12], "OPTIMAL")
        self.assertEqual(row[13], 494)          # monthly aerobic low
        self.assertEqual(row[14], 212)          # monthly aerobic high
        self.assertEqual(row[15], 0)            # monthly anaerobic
        self.assertEqual(row[16], "AEROBIC_HIGH_SHORTAGE")
        self.assertEqual(row[17], 51)           # readiness score
        self.assertEqual(row[18], "MODERATE")
        self.assertEqual(row[19], "LISTEN_TO_YOUR_BODY")
        self.assertEqual(row[20], 28.8)         # recovery hours = 1728/60
        self.assertEqual(row[21], 49)           # hrv weekly
        self.assertEqual(row[22], 5853)         # endurance (fallback path)
        self.assertEqual(row[23], 38)           # hill
        self.assertEqual(row[24], 50)           # altitude acclimation %
        self.assertEqual(row[25], 0)            # heat acclimation %
        self.assertEqual(row[26], "23:33")      # 5K
        self.assertEqual(row[27], "50:13")      # 10K
        self.assertEqual(row[28], "1:54:06")    # half
        self.assertEqual(row[29], "4:15:22")    # marathon
        self.assertEqual(row[30], "moja notatka")

    def test_all_empty_is_safe(self):
        row = build_row(DAY, existing_note="x", tz=WARSAW)
        self.assertEqual(len(row), len(HEADERS))
        self.assertTrue(row[0].startswith(DAY))
        self.assertEqual(row[30], "x")
        # every metric column blank, no exception
        self.assertTrue(all(cell == "" for cell in row[1:NOTE_COLUMN]))

    def test_vo2_fallback_from_training_status(self):
        row = build_row(
            DAY,
            max_metrics=[],  # no max metrics
            training_status=sample_training_status(),
            tz=WARSAW,
        )
        self.assertEqual(row[1], 48.6)  # pulled from mostRecentVO2Max.generic

    def test_hill_list_shape(self):
        row = build_row(DAY, hill={"hillScoreDTOList": [{"overallScore": 37}]}, tz=WARSAW)
        self.assertEqual(row[23], 37)

    def test_race_as_list(self):
        row = build_row(DAY, race=[{"time5K": 1413}], tz=WARSAW)
        self.assertEqual(row[26], "23:33")


# --- Integration: run import_wydolnosc against fakes (no live Garmin) ---

class FakeWorksheet:
    def __init__(self, values):
        self.values = [list(r) for r in values]
        self.appended = []
        self.batch_updates = []

    def row_values(self, n):
        return self.values[n - 1] if len(self.values) >= n else []

    def get_all_values(self):
        return self.values

    def append_rows(self, rows, value_input_option=None):
        self.appended.extend(rows)
        self.values.extend(list(r) for r in rows)

    def batch_update(self, payload, value_input_option=None):
        self.batch_updates.append(payload)


class FakeSheets:
    def __init__(self, worksheet):
        self._ws = worksheet
        self.created_with = None

    def get_or_create_worksheet(self, name, headers):
        self.created_with = (name, headers)
        return self._ws


class FakeApi:
    def __init__(self, *, fail_race=False):
        self.fail_race = fail_race

    def get_max_metrics(self, day):
        return sample_max_metrics()

    def get_training_status(self, day):
        return sample_training_status()

    def get_training_readiness(self, day):
        return sample_training_readiness()

    def get_endurance_score(self, day):
        return {"overallScore": 5853}

    def get_hill_score(self, day):
        return {"overallScore": 38}

    def get_race_predictions(self, start, end, _type):
        if self.fail_race:
            raise RuntimeError("boom - profil bez biegania")
        return {"time5K": 1413, "time10K": 3013, "timeHalfMarathon": 6846, "timeMarathon": 15322}

    def get_fitnessage_data(self, day):
        return {"biologicalAge": 27.4}


class FakeGarmin:
    def __init__(self, api):
        self.api = api

    def pause(self, seconds=None):
        pass


def _ctx(sheets):
    return ImportContext(
        config=SimpleNamespace(timezone=WARSAW),
        sheets=sheets,
        days=1,
        start_date=date(2026, 4, 16),
        end_date=date(2026, 4, 16),
    )


class IntegrationTests(unittest.TestCase):
    def test_registered_in_sort_config(self):
        self.assertIn("Wydolnosc", WORKSHEET_SORT)

    @patch.object(wydolnosc, "sort_worksheet_by_name", return_value=0)
    def test_append_new_day(self, _sort):
        ws = FakeWorksheet([HEADERS])
        sheets = FakeSheets(ws)
        result = import_wydolnosc(_ctx(sheets), FakeGarmin(FakeApi()))

        self.assertEqual(result.name, "wydolnosc")
        self.assertEqual(result.appended, 1)
        self.assertEqual(result.updated, 0)
        self.assertEqual(sheets.created_with[0], "Wydolnosc")
        self.assertEqual(len(ws.appended), 1)
        row = ws.appended[0]
        self.assertEqual(len(row), len(HEADERS))
        self.assertEqual(row[1], 48.6)
        self.assertEqual(row[26], "23:33")

    @patch.object(wydolnosc, "sort_worksheet_by_name", return_value=0)
    def test_failing_endpoint_does_not_lose_row(self, _sort):
        ws = FakeWorksheet([HEADERS])
        result = import_wydolnosc(_ctx(FakeSheets(ws)), FakeGarmin(FakeApi(fail_race=True)))
        self.assertEqual(result.appended, 1)
        row = ws.appended[0]
        self.assertEqual(row[1], 48.6)   # other metrics still present
        self.assertEqual(row[26], "")    # race blanked out, no crash

    @patch.object(wydolnosc, "sort_worksheet_by_name", return_value=0)
    def test_upsert_existing_day(self, _sort):
        existing = [HEADERS, [f"{DAY} 06:00:00"] + [""] * (len(HEADERS) - 1)]
        ws = FakeWorksheet(existing)
        result = import_wydolnosc(_ctx(FakeSheets(ws)), FakeGarmin(FakeApi()))

        self.assertEqual(result.updated, 1)
        self.assertEqual(result.appended, 0)
        self.assertTrue(ws.batch_updates, "spodziewano się batch_update dla istniejącego dnia")
        rng = ws.batch_updates[0][0]["range"]
        self.assertTrue(rng.startswith("A2:") and rng.endswith("2"))
        self.assertIn(LAST_COLUMN, rng)
        self.assertEqual(len(ws.batch_updates[0][0]["values"][0]), len(HEADERS))


if __name__ == "__main__":
    unittest.main()
