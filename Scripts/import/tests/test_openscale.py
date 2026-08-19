from __future__ import annotations

import sqlite3
import tempfile
import unittest
import zipfile
from datetime import date, datetime
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

from jarvis_import.config import date_range
from jarvis_import.dates import today_in_timezone
from jarvis_import.drive import DriveFile, is_openscale_backup_name, pick_latest_backup
from jarvis_import.importers.openscale import (
    COL_DATETIME,
    COL_WEIGHT,
    extract_db_path,
    read_openscale_rows,
    zip_db_members,
)
from jarvis_import.openscale_source import iter_local_openscale_backups, pick_latest_local_backup


WARSAW = ZoneInfo("Europe/Warsaw")


def _create_openscale_db(path: Path, measurements: list[tuple[int, int, float]]) -> None:
    con = sqlite3.connect(path)
    try:
        con.execute("CREATE TABLE Measurement (id INTEGER PRIMARY KEY, timestamp INTEGER)")
        con.execute("CREATE TABLE MeasurementType (id INTEGER PRIMARY KEY, key TEXT)")
        con.execute(
            "CREATE TABLE MeasurementValue ("
            "measurementId INTEGER, typeId INTEGER, floatValue REAL, textValue TEXT)"
        )
        con.execute("INSERT INTO MeasurementType (id, key) VALUES (1, 'WEIGHT')")
        for mid, timestamp_ms, weight in measurements:
            con.execute("INSERT INTO Measurement (id, timestamp) VALUES (?, ?)", (mid, timestamp_ms))
            con.execute(
                "INSERT INTO MeasurementValue (measurementId, typeId, floatValue) VALUES (?, 1, ?)",
                (mid, weight),
            )
        con.commit()
    finally:
        con.close()


class DriveSelectionTests(unittest.TestCase):
    def test_is_openscale_backup_name(self):
        self.assertTrue(is_openscale_backup_name("openScale.db_auto_backup.zip"))
        self.assertTrue(is_openscale_backup_name("openScale_2026-08-19.zip"))
        self.assertTrue(is_openscale_backup_name("openScale.db"))
        self.assertFalse(is_openscale_backup_name("notes.txt"))
        self.assertFalse(is_openscale_backup_name("openScale.csv"))

    def test_pick_latest_backup_by_modified_time(self):
        older = DriveFile(
            id="old",
            name="openScale.db_auto_backup.zip",
            modified_time="2026-08-17T12:00:00.000Z",
            size=14000,
        )
        newer = DriveFile(
            id="new",
            name="openScale_2026-08-19.zip",
            modified_time="2026-08-19T06:00:00.000Z",
            size=18000,
        )
        chosen = pick_latest_backup([older, newer])
        self.assertEqual(chosen.id, "new")


class LocalBackupTests(unittest.TestCase):
    def test_picks_newer_sibling_in_folder(self):
        with tempfile.TemporaryDirectory() as raw:
            folder = Path(raw)
            stale = folder / "openScale.db_auto_backup.zip"
            fresh = folder / "openScale_2026-08-19.zip"
            stale.write_bytes(b"PK\x03\x04stale")
            fresh.write_bytes(b"PK\x03\x04fresh-and-bigger")
            stale_mtime = 1_700_000_000
            fresh_mtime = 1_800_000_000
            import os

            os.utime(stale, (stale_mtime, stale_mtime))
            os.utime(fresh, (fresh_mtime, fresh_mtime))

            candidates = iter_local_openscale_backups(stale)
            self.assertEqual(len(candidates), 2)
            self.assertEqual(pick_latest_local_backup(candidates), fresh)


class ZipExtractTests(unittest.TestCase):
    def test_zip_db_members_nested_path(self):
        db_name, sidecars = zip_db_members(
            ["folder/openScale.db", "folder/openScale.db-wal", "readme.txt"]
        )
        self.assertEqual(db_name, "folder/openScale.db")
        self.assertEqual(sidecars, ["folder/openScale.db-wal"])

    def test_reads_wal_from_nested_zip(self):
        with tempfile.TemporaryDirectory() as raw:
            tmp = Path(raw)
            db_path = tmp / "openScale.db"
            con = sqlite3.connect(db_path)
            con.execute("PRAGMA journal_mode=WAL")
            con.execute("CREATE TABLE Measurement (id INTEGER PRIMARY KEY, timestamp INTEGER)")
            con.execute("CREATE TABLE MeasurementType (id INTEGER PRIMARY KEY, key TEXT)")
            con.execute(
                "CREATE TABLE MeasurementValue ("
                "measurementId INTEGER, typeId INTEGER, floatValue REAL, textValue TEXT)"
            )
            con.execute("INSERT INTO MeasurementType (id, key) VALUES (1, 'WEIGHT')")
            con.execute(
                "INSERT INTO Measurement (id, timestamp) VALUES (1, ?)",
                (1_724_000_000_000,),
            )
            con.execute(
                "INSERT INTO MeasurementValue (measurementId, typeId, floatValue) VALUES (1, 1, 80.0)"
            )
            con.commit()
            con.execute(
                "INSERT INTO Measurement (id, timestamp) VALUES (2, ?)",
                (1_724_086_400_000,),
            )
            con.execute(
                "INSERT INTO MeasurementValue (measurementId, typeId, floatValue) VALUES (2, 1, 81.5)"
            )
            con.commit()
            wal_path = tmp / "openScale.db-wal"
            self.assertTrue(wal_path.exists(), "SQLite WAL nie powstał — test środowiska")

            zip_path = tmp / "backup.zip"
            with zipfile.ZipFile(zip_path, "w") as archive:
                archive.write(db_path, "nested/openScale.db")
                archive.write(wal_path, "nested/openScale.db-wal")

            rows = read_openscale_rows(zip_path, WARSAW)
            weights = [row[COL_WEIGHT] for row in rows]
            self.assertEqual(len(rows), 2)
            self.assertEqual(weights, [80.0, 81.5])

    def test_extract_db_path_from_plain_db(self):
        with tempfile.TemporaryDirectory() as raw:
            db_path = Path(raw) / "openScale.db"
            _create_openscale_db(db_path, [(1, 1_724_000_000_000, 97.4)])
            extracted = extract_db_path(db_path)
            self.assertEqual(extracted, db_path)
            rows = read_openscale_rows(db_path, WARSAW)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0][COL_WEIGHT], 97.4)
            self.assertTrue(rows[0][COL_DATETIME].startswith("20"))


class DateRangeTests(unittest.TestCase):
    def test_today_in_timezone_after_utc_midnight(self):
        class FrozenDatetime(datetime):
            @classmethod
            def now(cls, tz=None):
                moment = datetime(2026, 8, 18, 23, 30, tzinfo=ZoneInfo("UTC"))
                return moment.astimezone(tz) if tz else moment

        with patch("jarvis_import.dates.datetime", FrozenDatetime):
            self.assertEqual(today_in_timezone(WARSAW), date(2026, 8, 19))
            self.assertEqual(today_in_timezone(ZoneInfo("UTC")), date(2026, 8, 18))

    def test_date_range_respects_explicit_end(self):
        start, end = date_range(3, end=date(2026, 8, 19), tz=WARSAW)
        self.assertEqual(end, date(2026, 8, 19))
        self.assertEqual(start, date(2026, 8, 17))


if __name__ == "__main__":
    unittest.main()
