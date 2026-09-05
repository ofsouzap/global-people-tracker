"""Safe, per-user JSON persistence for canonical datasets."""

from __future__ import annotations

import json
import os
import tempfile
import threading
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from app.models import Dataset


class RevisionConflictError(Exception):
    """Raised when a mutation is based on an old dataset revision."""


class PersonNotFoundError(Exception):
    """Raised when a requested person does not belong to the current user."""


class DatasetStore:
    """Owns all locked, atomic reads and mutations for per-user datasets."""

    def __init__(self, root: Path) -> None:
        self._root = root
        self._locks: dict[UUID, threading.RLock] = {}
        self._locks_guard = threading.Lock()

    def read(self, user_id: UUID) -> Dataset:
        """Read a user's dataset, creating its in-memory default when absent."""
        with self._lock_for(user_id):
            return self._read_unlocked(user_id)

    def mutate(
        self,
        user_id: UUID,
        expected_revision: int,
        mutation: Callable[[Dataset], None],
        *,
        deletion: bool = False,
    ) -> Dataset:
        """Apply one revision-guarded mutation and atomically persist it."""
        with self._lock_for(user_id):
            dataset = self._read_unlocked(user_id)
            if dataset.revision != expected_revision:
                raise RevisionConflictError
            previous_dataset = Dataset.model_validate(dataset.model_dump())
            mutation(dataset)
            self._create_daily_backup_unlocked(user_id, previous_dataset)
            if deletion:
                self._create_backup_unlocked(user_id, previous_dataset, "delete_person")
            dataset.revision += 1
            self._write_unlocked(user_id, dataset)
            return dataset

    def _lock_for(self, user_id: UUID) -> threading.RLock:
        with self._locks_guard:
            return self._locks.setdefault(user_id, threading.RLock())

    def _dataset_path(self, user_id: UUID) -> Path:
        return self._root / "users" / str(user_id) / "people.json"

    def _read_unlocked(self, user_id: UUID) -> Dataset:
        path = self._dataset_path(user_id)
        if not path.exists():
            return Dataset()
        with path.open(encoding="utf-8") as file:
            return Dataset.model_validate(json.load(file))

    def _create_daily_backup_unlocked(self, user_id: UUID, dataset: Dataset) -> None:
        backups = self._dataset_path(user_id).parent / "backups"
        today_prefix = datetime.now(UTC).date().isoformat()
        daily_backup_exists = backups.exists() and any(
            backups.glob(f"{today_prefix}T*_daily_*.json")
        )
        if not daily_backup_exists:
            self._create_backup_unlocked(user_id, dataset, "daily")

    def _create_backup_unlocked(self, user_id: UUID, dataset: Dataset, reason: str) -> None:
        backups = self._dataset_path(user_id).parent / "backups"
        backups.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(UTC).strftime("%Y-%m-%dT%H-%M-%S-%fZ")
        path = backups / f"{timestamp}_{reason}_{dataset.revision}.json"
        self._atomic_write(path, dataset.model_dump(mode="json"))

    def _write_unlocked(self, user_id: UUID, dataset: Dataset) -> None:
        self._atomic_write(self._dataset_path(user_id), dataset.model_dump(mode="json"))

    @staticmethod
    def _atomic_write(path: Path, contents: dict[str, object]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_path = tempfile.mkstemp(prefix=".people-", dir=path.parent, text=True)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as file:
                json.dump(contents, file, ensure_ascii=False, separators=(",", ":"))
                file.flush()
                os.fsync(file.fileno())
            os.replace(temporary_path, path)
            directory_descriptor = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(directory_descriptor)
            finally:
                os.close(directory_descriptor)
        except BaseException:
            if os.path.exists(temporary_path):
                os.unlink(temporary_path)
            raise
