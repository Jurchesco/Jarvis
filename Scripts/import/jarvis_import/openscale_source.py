from __future__ import annotations

import tempfile
from pathlib import Path

from .config import Config
from .drive import (
    backup_recency_ms,
    download_latest_openscale_backup,
    is_openscale_backup_name,
)


def iter_local_openscale_backups(path: Path) -> list[Path]:
    """Wszystkie zipy auto / dated w folderze (openScale przy 'nowy plik' dodaje epoch do nazwy)."""
    folder = path if path.is_dir() else path.parent
    found: list[Path] = []
    if folder.is_dir():
        for child in folder.iterdir():
            if child.is_file() and is_openscale_backup_name(child.name):
                found.append(child)
    if path.is_file() and path not in found:
        found.append(path)
    return found


def pick_latest_local_backup(files: list[Path]) -> Path:
    if not files:
        raise FileNotFoundError("Brak lokalnych plików backupu openScale")
    return max(
        files,
        key=lambda item: (
            backup_recency_ms(item.name, mtime=item.stat().st_mtime),
            item.stat().st_size,
            item.name,
        ),
    )


def resolve_openscale_backup(config: Config) -> Path | None:
    """Lokalny plik backupu (najnowszy w folderze) albo pobranie z Google Drive."""
    if config.openscale_backup:
        path = config.openscale_backup
        if path.exists():
            candidates = iter_local_openscale_backups(path)
            latest = pick_latest_local_backup(candidates)
            if latest.resolve() != path.resolve():
                print(
                    f"  Lokalnie nowszy backup niż OPENSCALE_BACKUP: {latest.name} "
                    f"({latest.stat().st_size // 1024} KB)"
                )
            return latest
        print(f"  Brak lokalnego pliku {path} — próbuję Google Drive")

    file_id = config.openscale_drive_file_id
    if not file_id:
        return config.openscale_backup

    tmp_dir = Path(tempfile.gettempdir()) / "jarvis-import"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    _, destination = download_latest_openscale_backup(
        config.google_credentials_file,
        file_id,
        tmp_dir,
        folder_id=config.openscale_drive_folder_id,
    )
    return destination
