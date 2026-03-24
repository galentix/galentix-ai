"""
Galentix AI - Backup & Restore Service
Handles creating, listing, restoring, and deleting data backups.
"""
import shutil
import json
import tarfile
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def create_backup(settings) -> str:
    """Create a backup of all data (database, documents, config).

    Copies the SQLite database, config directory, and uploaded documents
    into a timestamped tar.gz archive under ``<data_dir>/backups/``.

    This is a blocking function -- call via ``asyncio.to_thread``.

    Returns the absolute path to the backup archive.
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_dir = settings.data_dir / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)

    backup_name = f"galentix_backup_{timestamp}"
    temp_dir = backup_dir / backup_name
    temp_dir.mkdir()

    try:
        # Copy database
        db_path = settings.data_dir / "galentix.db"
        if db_path.exists():
            shutil.copy2(db_path, temp_dir / "galentix.db")

        # Copy config
        config_dir = settings.config_dir
        if config_dir.exists():
            shutil.copytree(config_dir, temp_dir / "config", dirs_exist_ok=True)

        # Copy uploaded documents
        docs_dir = settings.data_dir / "documents"
        if docs_dir.exists():
            shutil.copytree(docs_dir, temp_dir / "documents", dirs_exist_ok=True)

        # Create metadata
        includes = []
        if db_path.exists():
            includes.append("database")
        if config_dir.exists():
            includes.append("config")
        if docs_dir.exists():
            includes.append("documents")

        metadata = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "version": "2.0.0",
            "includes": includes,
        }
        with open(temp_dir / "backup_metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)

        # Create tar.gz archive
        archive_path = backup_dir / f"{backup_name}.tar.gz"
        with tarfile.open(archive_path, "w:gz") as tar:
            tar.add(temp_dir, arcname=backup_name)

        logger.info(f"Backup created: {archive_path}")
        return str(archive_path)

    finally:
        # Always clean up the temporary directory
        if temp_dir.exists():
            shutil.rmtree(temp_dir)


def list_backups(settings) -> list:
    """List available backup archives sorted newest-first.

    This is a blocking function -- call via ``asyncio.to_thread``.
    """
    backup_dir = settings.data_dir / "backups"
    if not backup_dir.exists():
        return []

    backups = []
    for f in sorted(backup_dir.glob("*.tar.gz"), reverse=True):
        stat = f.stat()
        backups.append({
            "filename": f.name,
            "size_bytes": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        })
    return backups


def restore_backup(settings, backup_filename: str) -> bool:
    """Restore data from a backup archive.

    Extracts the tar.gz, then replaces the database, config directory,
    and documents directory with the contents from the backup.

    This is a blocking function -- call via ``asyncio.to_thread``.

    Returns True on success, raises on failure.
    """
    backup_dir = settings.data_dir / "backups"
    archive_path = backup_dir / backup_filename

    if not archive_path.exists():
        raise FileNotFoundError(f"Backup not found: {backup_filename}")

    # Validate that the file is a proper tar.gz
    if not tarfile.is_tarfile(archive_path):
        raise ValueError(f"Invalid backup archive: {backup_filename}")

    # Extract to a temporary location
    extract_dir = backup_dir / "_restore_temp"
    if extract_dir.exists():
        shutil.rmtree(extract_dir)
    extract_dir.mkdir()

    try:
        with tarfile.open(archive_path, "r:gz") as tar:
            # Security: prevent path traversal
            for member in tar.getmembers():
                if member.name.startswith("/") or ".." in member.name:
                    raise ValueError("Backup archive contains unsafe paths")
            tar.extractall(path=extract_dir)

        # Find the backup root directory inside the extract
        extracted_dirs = [d for d in extract_dir.iterdir() if d.is_dir()]
        if not extracted_dirs:
            raise ValueError("Backup archive is empty or malformed")
        backup_root = extracted_dirs[0]

        # Validate metadata
        metadata_file = backup_root / "backup_metadata.json"
        if not metadata_file.exists():
            raise ValueError("Backup is missing metadata file")

        # Restore database
        backup_db = backup_root / "galentix.db"
        if backup_db.exists():
            target_db = settings.data_dir / "galentix.db"
            shutil.copy2(backup_db, target_db)
            logger.info("Database restored from backup")

        # Restore config
        backup_config = backup_root / "config"
        if backup_config.exists():
            target_config = settings.config_dir
            if target_config.exists():
                shutil.rmtree(target_config)
            shutil.copytree(backup_config, target_config)
            logger.info("Config restored from backup")

        # Restore documents
        backup_docs = backup_root / "documents"
        if backup_docs.exists():
            target_docs = settings.data_dir / "documents"
            if target_docs.exists():
                shutil.rmtree(target_docs)
            shutil.copytree(backup_docs, target_docs)
            logger.info("Documents restored from backup")

        logger.info(f"Backup restored successfully: {backup_filename}")
        return True

    finally:
        # Clean up temp extraction directory
        if extract_dir.exists():
            shutil.rmtree(extract_dir)


def delete_backup(settings, backup_filename: str) -> bool:
    """Delete a backup archive.

    This is a blocking function -- call via ``asyncio.to_thread``.

    Returns True if the file was deleted, False if it did not exist.
    """
    backup_dir = settings.data_dir / "backups"
    archive_path = backup_dir / backup_filename

    if not archive_path.exists():
        return False

    archive_path.unlink()
    logger.info(f"Backup deleted: {backup_filename}")
    return True
