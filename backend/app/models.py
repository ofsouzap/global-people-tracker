"""Typed domain and API models for the people tracker."""

from __future__ import annotations

from datetime import date
from math import isfinite
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class CoordinateCache(BaseModel):
    """Derived coordinates for a resolved location."""

    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)

    @field_validator("latitude", "longitude")
    @classmethod
    def coordinates_must_be_finite(cls, value: float) -> float:
        """Reject NaN and infinite coordinates."""
        if not isfinite(value):
            raise ValueError("coordinate must be finite")
        return value


class Location(BaseModel):
    """A country with optional region, city, and cached coordinates."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    country: str = Field(min_length=1, max_length=200)
    region: str | None = Field(default=None, min_length=1, max_length=200)
    city: str | None = Field(default=None, min_length=1, max_length=200)
    coordinate_cache: CoordinateCache | None = None


class MetDate(BaseModel):
    """A calendar date with optional day precision."""

    model_config = ConfigDict(extra="forbid")

    year: int = Field(ge=1, le=9999)
    month: int = Field(ge=1, le=12)
    day: int | None = Field(default=None, ge=1, le=31)

    @model_validator(mode="after")
    def day_must_be_valid_for_month(self) -> MetDate:
        """Validate the optional day against its year and month."""
        if self.day is not None:
            date(self.year, self.month, self.day)
        return self


class OtherContact(BaseModel):
    """An uncommon contact method."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    type: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=500)


def _empty_other_contacts() -> list[OtherContact]:
    return []


class Contacts(BaseModel):
    """Known contact fields plus arbitrary typed contact methods."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    instagram: str | None = Field(default=None, min_length=1, max_length=200)
    phone_number: str | None = Field(default=None, min_length=1, max_length=100)
    whatsapp: str | None = Field(default=None, min_length=1, max_length=100)
    email: str | None = Field(default=None, min_length=1, max_length=320)
    others: list[OtherContact] = Field(default_factory=_empty_other_contacts)

    @model_validator(mode="after")
    def other_contacts_must_not_duplicate_named_contacts(self) -> Contacts:
        """Keep a named contact from being repeated in the flexible contact list."""
        named_contacts = {
            "instagram": self.instagram,
            "phone_number": self.phone_number,
            "whatsapp": self.whatsapp,
            "email": self.email,
        }
        for contact in self.others:
            named_value = named_contacts.get(contact.type.lower())
            if named_value == contact.value:
                raise ValueError("other contacts must not duplicate named contacts")
        return self


class Person(BaseModel):
    """A person tracked by the authenticated user."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    id: UUID = Field(default_factory=uuid4)
    name: str = Field(min_length=1, max_length=200)
    based_location: Location | None = None
    met_location: Location | None = None
    met_date: MetDate | None = None
    contacts: Contacts = Field(default_factory=Contacts)
    notes: str = Field(default="", max_length=20_000)


def _empty_people() -> list[Person]:
    return []


class Dataset(BaseModel):
    """The complete canonical data stored for one user."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1] = 1
    revision: int = Field(default=0, ge=0)
    people: list[Person] = Field(default_factory=_empty_people)

    @model_validator(mode="after")
    def person_ids_must_be_unique(self) -> Dataset:
        """Prevent a dataset from containing ambiguous person records."""
        if len({person.id for person in self.people}) != len(self.people):
            raise ValueError("person IDs must be unique")
        return self


class PersonInput(BaseModel):
    """The mutable fields accepted when creating or updating a person."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=200)
    based_location: Location | None = None
    met_location: Location | None = None
    met_date: MetDate | None = None
    contacts: Contacts = Field(default_factory=Contacts)
    notes: str = Field(default="", max_length=20_000)


class CreatePersonRequest(BaseModel):
    """A revision-guarded person creation request."""

    model_config = ConfigDict(extra="forbid")

    expected_revision: int = Field(ge=0)
    person: PersonInput


class UpdatePersonRequest(CreatePersonRequest):
    """A revision-guarded person update request."""


class DeletePersonRequest(BaseModel):
    """A revision-guarded person deletion request."""

    model_config = ConfigDict(extra="forbid")

    expected_revision: int = Field(ge=0)


class PeopleResponse(BaseModel):
    """A user's people and the revision used for subsequent writes."""

    model_config = ConfigDict(extra="forbid")

    revision: int
    people: list[Person]


class PersonResponse(BaseModel):
    """A person returned after a mutation."""

    model_config = ConfigDict(extra="forbid")

    revision: int
    person: Person
