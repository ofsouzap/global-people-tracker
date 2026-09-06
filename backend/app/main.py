"""FastAPI application entry point."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Response, status

from app.auth import CurrentUser, get_current_user
from app.models import (
    CreatePersonRequest,
    Dataset,
    DeletePersonRequest,
    PeopleResponse,
    Person,
    PersonResponse,
    UpdatePersonRequest,
)
from app.persistence import DatasetStore, PersonNotFoundError, RevisionConflictError

app = FastAPI(title="Global People Tracker")
store = DatasetStore(Path(os.environ.get("PEOPLE_DATA_DIR", "data")))
CurrentUserDependency = Annotated[CurrentUser, Depends(get_current_user)]


def _revision_conflict() -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Dataset revision conflict")


def _person_or_not_found(people: list[Person], person_id: UUID) -> Person:
    for person in people:
        if person.id == person_id:
            return person
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")


@app.get("/api/people", response_model=PeopleResponse)
def list_people(current_user: CurrentUserDependency) -> PeopleResponse:
    """List only the current user's people."""
    dataset = store.read(current_user.id)
    return PeopleResponse(revision=dataset.revision, people=dataset.people)


@app.post("/api/people", response_model=PersonResponse, status_code=status.HTTP_201_CREATED)
def create_person(
    request: CreatePersonRequest, current_user: CurrentUserDependency
) -> PersonResponse:
    """Create a person in the current user's dataset."""
    created = Person(**request.person.model_dump())

    def add_person(dataset: Dataset) -> None:
        dataset.people.append(created)

    try:
        dataset = store.mutate(current_user.id, request.expected_revision, add_person)
    except RevisionConflictError:
        raise _revision_conflict() from None
    return PersonResponse(revision=dataset.revision, person=created)


@app.get("/api/people/{person_id}", response_model=PersonResponse)
def get_person(person_id: UUID, current_user: CurrentUserDependency) -> PersonResponse:
    """Return a person only if it belongs to the current user."""
    dataset = store.read(current_user.id)
    return PersonResponse(
        revision=dataset.revision, person=_person_or_not_found(dataset.people, person_id)
    )


@app.put("/api/people/{person_id}", response_model=PersonResponse)
def update_person(
    person_id: UUID,
    request: UpdatePersonRequest,
    current_user: CurrentUserDependency,
) -> PersonResponse:
    """Replace a current user's person with a revision-guarded update."""
    replacement = Person(id=person_id, **request.person.model_dump())

    def replace_person(dataset: Dataset) -> None:
        for index, person in enumerate(dataset.people):
            if person.id == person_id:
                dataset.people[index] = replacement
                return
        raise PersonNotFoundError

    try:
        dataset = store.mutate(current_user.id, request.expected_revision, replace_person)
    except RevisionConflictError:
        raise _revision_conflict() from None
    except PersonNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Person not found"
        ) from None
    return PersonResponse(revision=dataset.revision, person=replacement)


@app.delete("/api/people/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_person(
    person_id: UUID,
    request: DeletePersonRequest,
    current_user: CurrentUserDependency,
) -> Response:
    """Delete a person after saving an immediate backup."""

    def remove_person(dataset: Dataset) -> None:
        for index, person in enumerate(dataset.people):
            if person.id == person_id:
                del dataset.people[index]
                return
        raise PersonNotFoundError

    try:
        store.mutate(
            current_user.id,
            request.expected_revision,
            remove_person,
            create_backup_before_mutation=True,
        )
    except RevisionConflictError:
        raise _revision_conflict() from None
    except PersonNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Person not found"
        ) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)
