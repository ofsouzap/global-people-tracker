"""Tests for safe canonical dataset writes."""

from pathlib import Path
from uuid import uuid4

import pytest

from app import persistence
from app.models import Person
from app.persistence import DatasetStore


def test_failed_atomic_replacement_preserves_existing_dataset(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A failed final replace must leave the prior canonical file untouched."""
    user_id = uuid4()
    store = DatasetStore(tmp_path)
    store.mutate(user_id, 0, lambda dataset: dataset.people.append(Person(name="Ada")))

    original_replace = persistence.os.replace

    def fail_canonical_replace(source: str, destination: str | Path) -> None:
        if Path(destination).name == "people.json":
            raise OSError("simulated replacement failure")
        original_replace(source, destination)

    monkeypatch.setattr("app.persistence.os.replace", fail_canonical_replace)
    with pytest.raises(OSError, match="simulated replacement failure"):
        store.mutate(user_id, 1, lambda dataset: dataset.people.append(Person(name="Lin")))

    assert [person.name for person in store.read(user_id).people] == ["Ada"]
