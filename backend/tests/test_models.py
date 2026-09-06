"""Unit tests for persisted data validation."""

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models import Contacts, CoordinateCache, Dataset, Location, MetDate, OtherContact, Person


def test_person_without_based_location_is_valid() -> None:
    person = Person(name="Ada")

    assert person.based_location is None
    assert person.id


def test_location_requires_country_and_valid_coordinates() -> None:
    with pytest.raises(ValidationError):
        Location(country="")

    with pytest.raises(ValidationError):
        Location(country="Australia", coordinate_cache=CoordinateCache(latitude=91, longitude=0))


def test_met_date_validates_calendar_day() -> None:
    assert MetDate(year=2024, month=2, day=29).day == 29

    with pytest.raises(ValidationError):
        MetDate(year=2025, month=2, day=29)


def test_contacts_default_to_empty_other_contacts() -> None:
    assert Contacts().others == []

    with pytest.raises(ValidationError):
        Contacts(instagram="ada", others=[OtherContact(type="instagram", value="ada")])

    with pytest.raises(ValidationError):
        Contacts(instagram="ada", others=[OtherContact(type="Instagram", value="ada")])


def test_dataset_rejects_duplicate_person_ids() -> None:
    person_id = uuid4()
    with pytest.raises(ValidationError):
        Dataset(people=[Person(id=person_id, name="Ada"), Person(id=person_id, name="Lin")])
