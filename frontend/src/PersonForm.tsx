import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import type {
  Contacts,
  Location,
  OtherContact,
  MetDate,
  Person,
  PersonInput,
} from "./api";
import { countries, regionsByCountry } from "./locationData";

const emptyContacts = (): Contacts => ({ others: [] });

const emptyPerson = (): PersonInput => ({
  name: "",
  based_location: null,
  met_location: null,
  met_date: null,
  contacts: emptyContacts(),
  notes: "",
});

function LocationFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Location | null | undefined;
  onChange: (location: Location | null) => void;
}): React.JSX.Element {
  const country = value?.country ?? null;
  const regions = country ? regionsByCountry[country] : undefined;
  const update = (values: Partial<Location>): void => {
    const next = { ...value, ...values };
    onChange(next.country ? { country: next.country, ...next } : null);
  };

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{label}</Typography>
      <Autocomplete
        options={countries}
        value={country}
        onChange={(_, nextCountry) =>
          onChange(
            nextCountry
              ? { country: nextCountry, city: value?.city ?? null }
              : null,
          )
        }
        renderInput={(params) => <TextField {...params} label="Country" />}
      />
      {regions && (
        <Autocomplete
          options={regions}
          value={value?.region ?? null}
          onChange={(_, region) => update({ region })}
          renderInput={(params) => <TextField {...params} label="Region" />}
        />
      )}
      <TextField
        label="City"
        value={value?.city ?? ""}
        disabled={!country}
        onChange={(event) => update({ city: event.target.value || null })}
      />
    </Stack>
  );
}

function MetDateFields({
  value,
  onChange,
}: {
  value: MetDate | null | undefined;
  onChange: (date: MetDate | null) => void;
}): React.JSX.Element {
  const [year, setYear] = useState(value?.year.toString() ?? "");
  const [month, setMonth] = useState(value?.month.toString() ?? "");
  const [day, setDay] = useState(value?.day?.toString() ?? "");
  const updateDate = (
    nextYear: string,
    nextMonth: string,
    nextDay: string,
  ): void => {
    const parsedYear = Number(nextYear);
    const parsedMonth = Number(nextMonth);
    const parsedDay = Number(nextDay);
    if (
      !Number.isInteger(parsedYear) ||
      parsedYear < 1 ||
      !Number.isInteger(parsedMonth) ||
      parsedMonth < 1 ||
      parsedMonth > 12 ||
      (nextDay !== "" &&
        (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31))
    ) {
      onChange(null);
      return;
    }
    onChange({
      year: parsedYear,
      month: parsedMonth,
      day: nextDay === "" ? null : parsedDay,
    });
  };

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
      <TextField
        label="Met year"
        type="number"
        value={year}
        onChange={(event) => {
          const nextYear = event.target.value;
          setYear(nextYear);
          updateDate(nextYear, month, day);
        }}
      />
      <TextField
        label="Month"
        type="number"
        slotProps={{ htmlInput: { min: 1, max: 12 } }}
        value={month}
        onChange={(event) => {
          const nextMonth = event.target.value;
          setMonth(nextMonth);
          updateDate(year, nextMonth, day);
        }}
      />
      <TextField
        label="Day"
        type="number"
        slotProps={{ htmlInput: { min: 1, max: 31 } }}
        value={day}
        onChange={(event) => {
          const nextDay = event.target.value;
          setDay(nextDay);
          updateDate(year, month, nextDay);
        }}
      />
    </Stack>
  );
}

export function PersonForm({
  person,
  onSave,
  onDelete,
  onClose,
}: {
  person: Person | null;
  onSave: (person: PersonInput) => Promise<void>;
  onDelete: (person: Person) => Promise<void>;
  onClose: () => void;
}): React.JSX.Element {
  const [draft, setDraft] = useState<PersonInput>(person ?? emptyPerson());
  const [saving, setSaving] = useState(false);
  const setContacts = (contacts: Contacts): void =>
    setDraft((current) => ({ ...current, contacts }));
  const setOther = (index: number, updates: Partial<OtherContact>): void => {
    setContacts({
      ...draft.contacts,
      others: draft.contacts.others.map((contact, currentIndex) =>
        currentIndex === index ? { ...contact, ...updates } : contact,
      ),
    });
  };
  const save = async (): Promise<void> => {
    if (!draft.name.trim()) {
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...draft, name: draft.name.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open fullScreen onClose={onClose}>
      <DialogTitle>{person ? "Edit person" : "Add person"}</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1, pb: 3 }}>
          <TextField
            autoFocus
            required
            label="Name"
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
          <LocationFields
            label="Based location"
            value={draft.based_location}
            onChange={(based_location) =>
              setDraft({ ...draft, based_location })
            }
          />
          <LocationFields
            label="Where you met"
            value={draft.met_location}
            onChange={(met_location) => setDraft({ ...draft, met_location })}
          />
          <MetDateFields
            value={draft.met_date}
            onChange={(met_date) => setDraft({ ...draft, met_date })}
          />
          <Typography variant="subtitle2">Contact details</Typography>
          {(["instagram", "phone_number", "whatsapp", "email"] as const).map(
            (field) => (
              <TextField
                key={field}
                label={field.replace("_", " ")}
                value={draft.contacts[field] ?? ""}
                onChange={(event) =>
                  setContacts({
                    ...draft.contacts,
                    [field]: event.target.value || null,
                  })
                }
              />
            ),
          )}
          {draft.contacts.others.map((contact, index) => (
            <Stack direction="row" spacing={1} key={index}>
              <TextField
                label="Contact type"
                value={contact.type}
                onChange={(event) =>
                  setOther(index, { type: event.target.value })
                }
              />
              <TextField
                label="Contact value"
                value={contact.value}
                onChange={(event) =>
                  setOther(index, { value: event.target.value })
                }
              />
              <IconButton
                aria-label="Remove other contact"
                onClick={() =>
                  setContacts({
                    ...draft.contacts,
                    others: draft.contacts.others.filter(
                      (_, currentIndex) => currentIndex !== index,
                    ),
                  })
                }
              >
                ×
              </IconButton>
            </Stack>
          ))}
          <Button
            onClick={() =>
              setContacts({
                ...draft.contacts,
                others: [...draft.contacts.others, { type: "", value: "" }],
              })
            }
          >
            Add other contact
          </Button>
          <TextField
            label="Notes"
            multiline
            minRows={4}
            value={draft.notes}
            onChange={(event) =>
              setDraft({ ...draft, notes: event.target.value })
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        {person && (
          <Button color="error" onClick={() => void onDelete(person)}>
            Delete person
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!draft.name.trim() || saving}
          onClick={() => void save()}
        >
          Save person
        </Button>
      </DialogActions>
    </Dialog>
  );
}
