from __future__ import annotations

import time
from datetime import date, timedelta

from garminconnect import Garmin

from .config import Config


class GarminClient:
    def __init__(self, config: Config):
        self._config = config
        self._api: Garmin | None = None

    @property
    def api(self) -> Garmin:
        if self._api is None:
            api = Garmin()
            api.login(str(self._config.garmin_token_dir))
            self._api = api
        return self._api

    def pause(self, seconds: float | None = None) -> None:
        time.sleep(seconds if seconds is not None else self._config.request_delay_sec)


def iter_days(start: date, end: date):
    current = start
    while current <= end:
        yield current.isoformat(), current
        current += timedelta(days=1)
