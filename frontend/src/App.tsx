import {
  Alert,
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Fab,
  Snackbar,
  Toolbar,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import {
  createPerson,
  deletePerson,
  getPeople,
  RevisionConflictError,
  type Person,
  type PersonInput,
  updatePerson,
} from "./api";
import { PeopleScreen } from "./PeopleScreen";
import { PersonForm } from "./PersonForm";

type Page = "map" | "people" | "settings";

interface PeopleDataset {
  people: Person[];
  revision: number;
}

function App(): React.JSX.Element {
  const [page, setPage] = useState<Page>("people");
  const [dataset, setDataset] = useState<PeopleDataset>({
    people: [],
    revision: 0,
  });
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Person | null | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const loadPeople = useCallback(async () => {
    try {
      const response = await getPeople();
      setDataset(response);
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
        ? await updatePerson(editing.id, input, dataset.revision)
        : await createPerson(input, dataset.revision);
      setDataset((current) => ({
        people: editing
          ? current.people.map((person) =>
              person.id === editing.id ? response.person : person,
            )
          : [...current.people, response.person],
        revision: response.revision,
      }));
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
      await deletePerson(person.id, dataset.revision);
      setDataset((current) => ({
        people: current.people.filter(
          (currentPerson) => currentPerson.id !== person.id,
        ),
        revision: current.revision + 1,
      }));
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
          <PeopleScreen
            people={dataset.people}
            query={query}
            onQueryChange={setQuery}
            onEdit={setEditing}
          />
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
