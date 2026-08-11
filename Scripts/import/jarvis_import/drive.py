from __future__ import annotations

import io
from pathlib import Path

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


def download_drive_file(credentials_file: Path, file_id: str, destination: Path) -> Path:
    """Pobiera plik z Google Drive (Service Account musi mieć dostęp do pliku)."""
    creds = Credentials.from_service_account_file(str(credentials_file), scopes=DRIVE_SCOPES)
    service = build("drive", "v3", credentials=creds, cache_discovery=False)

    destination.parent.mkdir(parents=True, exist_ok=True)

    request = service.files().get_media(fileId=file_id)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)

    done = False
    while not done:
        _, done = downloader.next_chunk()

    destination.write_bytes(buffer.getvalue())
    return destination
