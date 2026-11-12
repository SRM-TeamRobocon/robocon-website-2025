"""Encrypted daily logical backup of the original Supabase database.

Run from Task Scheduler as this Windows user, with the project files available:
    python scripts/backup-supabase-daily.py
    python scripts/backup-supabase-daily.py --check
Requires the portable PostgreSQL 17 client and Python cryptography package.
"""

import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


PROJECT = Path(__file__).resolve().parents[1]
BACKUPS = (PROJECT / "../robocon-backups/daily-original").resolve()
TOOLS = (PROJECT / "../robocon-backups/tools/postgresql-17.11/pgsql/bin").resolve()
KEY_FILE = Path.home() / "Documents/SRM-Robocon-Recovery-Keys/robocon-pre-image-2026-11-12.key"
PROJECT_REF = "fcdaqslblhrjzioeuloe"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def key_bytes():
    key = bytes.fromhex(KEY_FILE.read_text(encoding="ascii").strip())
    if len(key) != 32:
        raise RuntimeError("Recovery key must be 32 bytes")
    return key


def check():
    latest = json.loads((BACKUPS / "LATEST.json").read_text(encoding="utf-8"))
    age_hours = (datetime.now(timezone.utc) - datetime.fromisoformat(latest["created_at_utc"])).total_seconds() / 3600
    if age_hours > 36:
        raise RuntimeError(f"Latest database backup is stale: {age_hours:.1f} hours")
    encrypted = (BACKUPS / latest["file"]).read_bytes()
    if digest(encrypted) != latest["encrypted_sha256"]:
        raise RuntimeError("Encrypted backup checksum mismatch")
    plain = AESGCM(key_bytes()).decrypt(encrypted[:12], encrypted[12:], latest["file"].encode("utf-8"))
    if digest(plain) != latest["database_sha256"]:
        raise RuntimeError("Decrypted database checksum mismatch")
    print("backup_fresh_and_verified", latest["created_at_utc"], len(plain))


def backup():
    settings = {}
    for line in (PROJECT / ".env.local").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.startswith("#"):
            name, value = line.split("=", 1)
            settings[name] = value.strip().strip('"')
    database = urlparse(settings["DATABASE_URL"])
    if database.hostname != f"db.{PROJECT_REF}.supabase.co" or not database.password:
        raise RuntimeError("DATABASE_URL does not point to the original Supabase project")
    BACKUPS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    name = f"original-{stamp}.dump.aesgcm"
    temporary = BACKUPS / f"original-{stamp}.dump.partial"
    encrypted_path = BACKUPS / name
    environment = os.environ.copy()
    environment["PGPASSWORD"] = unquote(database.password)
    environment["PGSSLMODE"] = "require"
    environment["PGCONNECT_TIMEOUT"] = "10"
    command = [
        str(TOOLS / "pg_dump.exe"), "--host", database.hostname,
        "--port", str(database.port or 5432), "--username", unquote(database.username),
        "--dbname", database.path.lstrip("/"), "--format", "custom", "--blobs",
        "--no-owner", "--lock-wait-timeout", "3000", "--file", str(temporary),
    ]
    if temporary.exists() or encrypted_path.exists():
        raise RuntimeError("A backup with this timestamp already exists")
    try:
        reachable = subprocess.run(
            [str(TOOLS / "pg_isready.exe"), "--host", database.hostname,
             "--port", str(database.port or 5432), "--timeout", "10"],
            env=environment, capture_output=True, text=True, timeout=15,
        )
        if reachable.returncode:
            raise RuntimeError("Original Supabase database is not reachable")
        result = subprocess.run(command, env=environment, capture_output=True, text=True, timeout=900)
        if result.returncode:
            raise RuntimeError("pg_dump failed: " + result.stderr[-300:])
        verify = subprocess.run([str(TOOLS / "pg_restore.exe"), "--list", str(temporary)], capture_output=True, text=True, timeout=120)
        if verify.returncode or "TABLE DATA public members" not in verify.stdout:
            raise RuntimeError("pg_restore could not read the database dump")
        plain = temporary.read_bytes()
        nonce = os.urandom(12)
        encrypted = nonce + AESGCM(key_bytes()).encrypt(nonce, plain, name.encode("utf-8"))
        with encrypted_path.open("xb") as output:
            output.write(encrypted)
        manifest = {
            "project": PROJECT_REF,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "file": name,
            "encrypted_sha256": digest(encrypted),
            "database_sha256": digest(plain),
            "database_bytes": len(plain),
            "format": "PostgreSQL custom dump, AES-256-GCM; nonce prefix, filename as AAD",
        }
        (BACKUPS / f"{name}.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        pointer = BACKUPS / "LATEST.json.tmp"
        pointer.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        pointer.replace(BACKUPS / "LATEST.json")
        check()
    finally:
        if temporary.exists():
            temporary.unlink()


if __name__ == "__main__":
    if sys.argv[1:] == ["--check"]:
        check()
    elif not sys.argv[1:]:
        backup()
    else:
        raise SystemExit("Usage: backup-supabase-daily.py [--check]")
