from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from ..config import Config
from ..sheets import SheetsClient


@dataclass
class ImportContext:
    config: Config
    sheets: SheetsClient
    days: int
    start_date: date
    end_date: date
