from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
DRIVE_FIELDS = "id,name,mimeType,modifiedTime,size,md5Checksum,parents,shortcutDetails"
SHORTCUT_MIME = "application/vnd.google-apps.shortcut"


@dataclass(frozen=True)
class DriveFile:
    id: str
    name: str
    mime_type: str = ""
    modified_time: str = ""
    size: int = 0
    md5: str = ""
    parents: tuple[str, ...] = ()
    shortcut_target_id: str | None = None

    def describe(self) -> str:
        size_kb = self.size // 1024 if self.size else 0
        md5_short = (self.md5 or "?")[:8]
        return (
            f"{self.name} ({size_kb} KB, modified={self.modified_time or '?'}, "
            f"md5={md5_short}, id={self.id[:8]}...)"
        )


def is_openscale_backup_name(name: str) -> bool:
    lower = (name or "").lower()
    if "openscale" not in lower:
        return False
    return lower.endswith(".zip") or lower.endswith(".db")


def parse_drive_file(raw: dict) -> DriveFile:
    shortcut = (raw.get("shortcutDetails") or {}).get("targetId")
    try:
        size = int(raw.get("size") or 0)
    except (TypeError, ValueError):
        size = 0
    return DriveFile(
        id=raw["id"],
        name=raw.get("name") or "",
        mime_type=raw.get("mimeType") or "",
        modified_time=raw.get("modifiedTime") or "",
        size=size,
        md5=raw.get("md5Checksum") or "",
        parents=tuple(raw.get("parents") or ()),
        shortcut_target_id=shortcut,
    )


def pick_latest_backup(files: list[DriveFile]) -> DriveFile:
    if not files:
        raise ValueError("Brak plików backupu openScale")
    return max(files, key=lambda item: (item.modified_time or "", item.size, item.name))


def build_drive_service(credentials_file: Path):
    creds = Credentials.from_service_account_file(str(credentials_file), scopes=DRIVE_SCOPES)
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _get_file(service, file_id: str) -> DriveFile:
    raw = (
        service.files()
        .get(fileId=file_id, fields=DRIVE_FIELDS, supportsAllDrives=True)
        .execute()
    )
    info = parse_drive_file(raw)
    if info.mime_type == SHORTCUT_MIME and info.shortcut_target_id:
        return _get_file(service, info.shortcut_target_id)
    return info


def _list_files(service, query: str) -> list[DriveFile]:
    files: list[DriveFile] = []
    page_token = None
    while True:
        resp = (
            service.files()
            .list(
                q=query,
                fields=f"nextPageToken, files({DRIVE_FIELDS})",
                pageSize=100,
                pageToken=page_token,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        files.extend(parse_drive_file(item) for item in resp.get("files") or [])
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return files


def collect_openscale_drive_candidates(
    service,
    file_id: str,
    folder_id: str | None = None,
) -> tuple[DriveFile, list[DriveFile]]:
    """Zwraca plik z konfiguracji oraz kandydatów (ten plik, rodzeństwo, wyszukiwanie nazwy)."""
    configured = _get_file(service, file_id)
    candidates: dict[str, DriveFile] = {configured.id: configured}

    folder_ids: list[str] = []
    if folder_id:
        folder_ids.append(folder_id)
    folder_ids.extend(parent for parent in configured.parents if parent not in folder_ids)

    for parent_id in folder_ids:
        try:
            for item in _list_files(service, f"'{parent_id}' in parents and trashed=false"):
                if is_openscale_backup_name(item.name):
                    candidates[item.id] = item
        except Exception as error:
            print(f"  Nie mogę listować folderu Drive {parent_id[:8]}...: {error}")

    try:
        query = (
            "trashed=false and (name contains 'openScale' or name contains 'openscale')"
        )
        for item in _list_files(service, query):
            if is_openscale_backup_name(item.name):
                candidates[item.id] = item
    except Exception as error:
        print(f"  Wyszukiwanie backupów openScale na Drive nieudane: {error}")

    return configured, list(candidates.values())


def download_drive_file(
    credentials_file: Path,
    file_id: str,
    destination: Path,
    *,
    service=None,
) -> Path:
    """Pobiera plik z Google Drive (Service Account musi mieć dostęp do pliku)."""
    if service is None:
        service = build_drive_service(credentials_file)

    destination.parent.mkdir(parents=True, exist_ok=True)

    request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)

    done = False
    while not done:
        _, done = downloader.next_chunk()

    destination.write_bytes(buffer.getvalue())
    return destination


def download_latest_openscale_backup(
    credentials_file: Path,
    file_id: str,
    destination_dir: Path,
    folder_id: str | None = None,
) -> tuple[DriveFile, Path]:
    service = build_drive_service(credentials_file)
    configured, candidates = collect_openscale_drive_candidates(service, file_id, folder_id)
    print(f"  Drive (skonfigurowany): {configured.describe()}")
    if len(candidates) > 1:
        print(f"  Znaleziono {len(candidates)} backupów openScale dostępnych dla Service Account")

    chosen = pick_latest_backup(candidates)
    if chosen.id != configured.id:
        print(f"  Nowszy backup niż OPENSCALE_DRIVE_FILE_ID: {chosen.describe()}")
    else:
        print(f"  Pobieram: {chosen.describe()}")

    suffix = ".db" if chosen.name.lower().endswith(".db") else ".zip"
    destination = destination_dir / f"openScale_backup{suffix}"
    download_drive_file(credentials_file, chosen.id, destination, service=service)
    print(f"  Zapisano: {destination} ({destination.stat().st_size // 1024} KB)")
    return chosen, destination
