from __future__ import annotations

import os
import tempfile
from pathlib import Path

from .config import Config
from .drive import download_drive_file


def resolve_openscale_backup(config: Config) -> Path | None:
    """Lokalny plik backupu lub pobranie z Google Drive (OPENSCALE_DRIVE_FILE_ID)."""
    if config.openscale_backup and config.openscale_backup.exists():
        return config.openscale_backup

    file_id = os.getenv("OPENSCALE_DRIVE_FILE_ID")
    if not file_id:
        return config.openscale_backup

    tmp_dir = Path(tempfile.gettempdir()) / "jarvis-import"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    destination = tmp_dir / "openScale.db_auto_backup.zip"

    print(f"  Pobieram backup openScale z Google Drive (id={file_id[:8]}...)...")
    download_drive_file(config.google_credentials_file, file_id, destination)
    print(f"  Zapisano: {destination} ({destination.stat().st_size // 1024} KB)")
    return destination
