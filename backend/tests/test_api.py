"""API tests for authenticated, revision-aware people CRUD."""

# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false

from collections.abc import Iterator
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

import app.main
from app.persistence import DatasetStore


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """Provide an isolated data store for each API test."""
    monkeypatch.setattr(app.main, "store", DatasetStore(tmp_path))
    with TestClient(app.main.app) as test_client:
        yield test_client


def headers(user_id: UUID) -> dict[str, str]:
    """Build the development identity header."""
    return {"X-Development-User": str(user_id)}


def person_payload(name: str, revision: int = 0) -> dict[str, object]:
    """Build a minimal valid creation or update request."""
    return {"expected_revision": revision, "person": {"name": name}}


def test_crud_is_isolated_by_current_user(client: TestClient) -> None:
    first_user, second_user = uuid4(), uuid4()
    created = client.post("/api/people", headers=headers(first_user), json=person_payload("Ada"))

    assert created.status_code == 201
    person_id = created.json()["person"]["id"]
    assert client.get("/api/people", headers=headers(second_user)).json() == {
        "revision": 0,
        "people": [],
    }

    listed = client.get("/api/people", headers=headers(first_user))
    assert listed.json()["people"][0]["name"] == "Ada"

    updated = client.put(
        f"/api/people/{person_id}",
        headers=headers(first_user),
        json=person_payload("Ada Lovelace", revision=1),
    )
    assert updated.status_code == 200
    assert updated.json()["revision"] == 2

    deleted = client.request(
        "DELETE",
        f"/api/people/{person_id}",
        headers=headers(first_user),
        json={"expected_revision": 2},
    )
    assert deleted.status_code == 204
    assert client.get("/api/people", headers=headers(first_user)).json() == {
        "revision": 3,
        "people": [],
    }


def test_stale_write_is_rejected_without_modifying_data(client: TestClient) -> None:
    user_id = uuid4()
    assert (
        client.post("/api/people", headers=headers(user_id), json=person_payload("Ada")).status_code
        == 201
    )

    response = client.post(
        "/api/people", headers=headers(user_id), json=person_payload("Lin", revision=0)
    )

    assert response.status_code == 409
    assert [
        person["name"]
        for person in client.get("/api/people", headers=headers(user_id)).json()["people"]
    ] == ["Ada"]


def test_delete_creates_daily_and_immediate_backups(client: TestClient, tmp_path: Path) -> None:
    user_id = uuid4()
    created = client.post(
        "/api/people", headers=headers(user_id), json=person_payload("Ada")
    ).json()
    person_id = created["person"]["id"]

    assert (
        client.request(
            "DELETE",
            f"/api/people/{person_id}",
            headers=headers(user_id),
            json={"expected_revision": 1},
        ).status_code
        == 204
    )

    backups = list((tmp_path / "users" / str(user_id) / "backups").glob("*.json"))
    assert any("_daily_" in backup.name for backup in backups)
    assert any("_delete_person_" in backup.name for backup in backups)


def test_development_auth_rejects_missing_identity(client: TestClient) -> None:
    assert client.get("/api/people").status_code == 401
