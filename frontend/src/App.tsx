import {
  Alert,
  AppBar,
  Autocomplete,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Fab,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Snackbar,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import {
  createPerson,
  deletePerson,
  getPeople,
  RevisionConflictError,
  type Contacts,
  type Location,
  type OtherContact,
  type Person,
  type PersonInput,
  updatePerson,
} from "./api";
import { countries, regionsByCountry } from "./locationData";

type Page = "map" | "people" | "settings";

const emptyContacts = (): Contacts => ({ others: [] });

const emptyPerson = (): PersonInput => ({
  name: "",
  based_location: null,
  met_location: null,
  met_date: null,
  contacts: emptyContacts(),
  notes: "",
});

function locationLabel(location: Location | null | undefined): string {
  return [location?.city, location?.region, location?.country]
    .filter(Boolean)
    .join(", ");
}

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

function PersonForm({
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
          <Stack direction="row" spacing={1}>
            <TextField
              label="Met year"
              type="number"
              value={draft.met_date?.year ?? ""}
              onChange={(event) => {
                const year = Number(event.target.value);
                setDraft({
                  ...draft,
                  met_date:
                    Number.isInteger(year) && year > 0
                      ? {
                          ...draft.met_date,
                          year,
                          month: draft.met_date?.month ?? 1,
                        }
                      : null,
                });
              }}
            />
            <TextField
              label="Month"
              type="number"
              slotProps={{ htmlInput: { min: 1, max: 12 } }}
              value={draft.met_date?.month ?? ""}
              onChange={(event) => {
                const month = Number(event.target.value);
                setDraft({
                  ...draft,
                  met_date:
                    draft.met_date && month >= 1 && month <= 12
                      ? { ...draft.met_date, month }
                      : draft.met_date,
                });
              }}
            />
            <TextField
              label="Day"
              type="number"
              slotProps={{ htmlInput: { min: 1, max: 31 } }}
              value={draft.met_date?.day ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  met_date: draft.met_date
                    ? {
                        ...draft.met_date,
                        day: Number(event.target.value) || null,
                      }
                    : null,
                })
              }
            />
          </Stack>
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

function App(): React.JSX.Element {
  const [page, setPage] = useState<Page>("people");
  const [people, setPeople] = useState<Person[]>([]);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Person | null | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const loadPeople = useCallback(async () => {
    try {
      const response = await getPeople();
      setPeople(response.people);
      setRevision(response.revision);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load people.",
      );
    }
  }, []);

  useEffect(() => {
    void loadPeople();
  }, [loadPeople]);

  const save = async (input: PersonInput): Promise<void> => {
    try {
      const response = editing
        ? await updatePerson(editing.id, input, revision)
        : await createPerson(input, revision);
      setPeople((current) =>
        editing
          ? current.map((person) =>
              person.id === editing.id ? response.person : person,
            )
          : [...current, response.person],
      );
      setRevision(response.revision);
      setEditing(undefined);
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        await loadPeople();
      }
      setMessage(
        error instanceof Error ? error.message : "Unable to save person.",
      );
    }
  };
  const remove = async (person: Person): Promise<void> => {
    if (!window.confirm(`Delete ${person.name}?`)) {
      return;
    }
    try {
      await deletePerson(person.id, revision);
      setPeople((current) =>
        current.filter((currentPerson) => currentPerson.id !== person.id),
      );
      setRevision((current) => current + 1);
      setEditing(undefined);
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        await loadPeople();
      }
      setMessage(
        error instanceof Error ? error.message : "Unable to delete person.",
      );
    }
  };
  const filteredPeople = people.filter((person) =>
    person.name.toLowerCase().includes(query.toLowerCase()),
  );
  const locatedPeople = filteredPeople.filter(
    (person) => person.based_location,
  );
  const unlocatedPeople = filteredPeople.filter(
    (person) => !person.based_location,
  );

  return (
    <Box
      sx={{
        maxWidth: 600,
        minHeight: "100vh",
        mx: "auto",
        bgcolor: "background.paper",
        pb: 9,
      }}
    >
      <AppBar position="sticky">
        <Toolbar>
          <Typography variant="h6">Global People Tracker</Typography>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ p: 2 }}>
        {page === "people" && (
          <Stack spacing={2}>
            <TextField
              label="Search people"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              fullWidth
            />
            <Typography variant="h6">People</Typography>
            <List disablePadding>
              {locatedPeople.map((person) => (
                <ListItem key={person.id} disablePadding>
                  <ListItemButton onClick={() => setEditing(person)}>
                    <ListItemText
                      primary={person.name}
                      secondary={locationLabel(person.based_location)}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
            <Divider />
            <Typography variant="h6">No based location</Typography>
            <List disablePadding>
              {unlocatedPeople.map((person) => (
                <ListItem key={person.id} disablePadding>
                  <ListItemButton onClick={() => setEditing(person)}>
                    <ListItemText
                      primary={person.name}
                      secondary="Location not recorded"
                    />
                  </ListItemButton>
                </ListItem>
              ))}
              {unlocatedPeople.length === 0 && (
                <Typography color="text.secondary">
                  Everyone in this search has a based location.
                </Typography>
              )}
            </List>
          </Stack>
        )}
        {page === "map" && <Typography>Map view is coming soon.</Typography>}
        {page === "settings" && (
          <Typography>Settings are coming soon.</Typography>
        )}
      </Box>
      {page === "people" && (
        <Fab
          color="primary"
          aria-label="Add person"
          onClick={() => setEditing(null)}
          sx={{ position: "fixed", bottom: 72, right: 24 }}
        >
          +
        </Fab>
      )}
      <BottomNavigation
        value={page}
        onChange={(_, value: Page) => setPage(value)}
        sx={{ position: "fixed", bottom: 0, left: 0, right: 0 }}
      >
        <BottomNavigationAction label="Map" value="map" icon={<span>⌖</span>} />
        <BottomNavigationAction
          label="People"
          value="people"
          icon={<span>●</span>}
        />
        <BottomNavigationAction
          label="Settings"
          value="settings"
          icon={<span>⚙</span>}
        />
      </BottomNavigation>
      {editing !== undefined && (
        <PersonForm
          person={editing}
          onSave={save}
          onDelete={remove}
          onClose={() => setEditing(undefined)}
        />
      )}
      <Snackbar
        open={Boolean(message)}
        autoHideDuration={6000}
        onClose={() => setMessage(null)}
      >
        <Alert severity="error" onClose={() => setMessage(null)}>
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default App;
