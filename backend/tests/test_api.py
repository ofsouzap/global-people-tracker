"""API tests for authenticated, revision-aware people CRUD."""

from collections.abc import Iterator
from pathlib import Path
from typing import Protocol, cast
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

import app.main
from app.models import PeopleResponse, PersonResponse
from app.persistence import DatasetStore


class ApiResponse(Protocol):
    """The typed response operations exercised by these API tests."""

    status_code: int

    def json(self) -> object: ...


class ApiClient(Protocol):
    """The typed HTTP operations exercised by these API tests."""

    def get(self, url: str, *, headers: dict[str, str] | None = None) -> ApiResponse: ...

    def post(
        self, url: str, *, headers: dict[str, str] | None = None, json: object | None = None
    ) -> ApiResponse: ...

    def put(
        self, url: str, *, headers: dict[str, str] | None = None, json: object | None = None
    ) -> ApiResponse: ...

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        json: object | None = None,
    ) -> ApiResponse: ...


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[ApiClient]:
    """Provide an isolated data store for each API test."""
    monkeypatch.setattr(app.main, "store", DatasetStore(tmp_path))
    with TestClient(app.main.app) as test_client:
        yield cast(ApiClient, test_client)


def headers(user_id: UUID) -> dict[str, str]:
    """Build the development identity header."""
    return {"X-Development-User": str(user_id)}


def person_payload(name: str, revision: int = 0) -> dict[str, object]:
    """Build a minimal valid creation or update request."""
    return {"expected_revision": revision, "person": {"name": name}}


def test_crud_for_current_user(client: ApiClient) -> None:
    user_id = uuid4()
    created = client.post("/api/people", headers=headers(user_id), json=person_payload("Ada"))

    assert created.status_code == 201
    created_person = PersonResponse.model_validate(created.json())
    person_id = created_person.person.id

    listed = PeopleResponse.model_validate(
        client.get("/api/people", headers=headers(user_id)).json()
    )
    assert listed.people[0].name == "Ada"

    updated = client.put(
        f"/api/people/{person_id}",
        headers=headers(user_id),
        json=person_payload("Ada Lovelace", revision=1),
    )
    assert updated.status_code == 200
    assert PersonResponse.model_validate(updated.json()).revision == 2

    deleted = client.request(
        "DELETE",
        f"/api/people/{person_id}",
        headers=headers(user_id),
        json={"expected_revision": 2},
    )
    assert deleted.status_code == 204
    assert PeopleResponse.model_validate(
        client.get("/api/people", headers=headers(user_id)).json()
    ) == PeopleResponse(revision=3, people=[])


def test_people_are_isolated_by_current_user(client: ApiClient) -> None:
    first_user, second_user = uuid4(), uuid4()
    assert (
        client.post(
            "/api/people", headers=headers(first_user), json=person_payload("Ada")
        ).status_code
        == 201
    )

    assert PeopleResponse.model_validate(
        client.get("/api/people", headers=headers(second_user)).json()
    ) == PeopleResponse(revision=0, people=[])


def test_stale_write_is_rejected_without_modifying_data(client: ApiClient) -> None:
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
        person.name
        for person in PeopleResponse.model_validate(
            client.get("/api/people", headers=headers(user_id)).json()
        ).people
    ] == ["Ada"]


def test_delete_creates_daily_and_immediate_backups(client: ApiClient, tmp_path: Path) -> None:
    user_id = uuid4()
    created = client.post("/api/people", headers=headers(user_id), json=person_payload("Ada"))
    person_id = PersonResponse.model_validate(created.json()).person.id

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
    assert len(backups) == 2
    assert any("_daily_" in backup.name for backup in backups)
    assert any("_delete_person_" in backup.name for backup in backups)


def test_development_auth_rejects_missing_identity(client: ApiClient) -> None:
    assert client.get("/api/people").status_code == 401
