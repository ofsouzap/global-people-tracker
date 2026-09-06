import {
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { Location, Person } from "./api";

function locationLabel(location: Location | null | undefined): string {
  return [location?.city, location?.region, location?.country]
    .filter(Boolean)
    .join(", ");
}

export function PeopleScreen({
  people,
  query,
  onQueryChange,
  onEdit,
}: {
  people: Person[];
  query: string;
  onQueryChange: (query: string) => void;
  onEdit: (person: Person) => void;
}): React.JSX.Element {
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
    <Stack spacing={2}>
      <TextField
        label="Search people"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        fullWidth
      />
      <Typography variant="h6">People</Typography>
      <List disablePadding>
        {locatedPeople.map((person) => (
          <ListItem key={person.id} disablePadding>
            <ListItemButton onClick={() => onEdit(person)}>
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
            <ListItemButton onClick={() => onEdit(person)}>
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
  );
}
