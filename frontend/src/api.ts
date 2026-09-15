export interface CoordinateCache {
  latitude: number;
  longitude: number;
}

export interface Location {
  country: string;
  region?: string | null;
  city?: string | null;
  coordinate_cache?: CoordinateCache | null;
}

export interface MetDate {
  year: number;
  month: number;
  day?: number | null;
}

export interface OtherContact {
  type: string;
  value: string;
}

export interface Contacts {
  instagram?: string | null;
  phone_number?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  others: OtherContact[];
}

export interface PersonInput {
  name: string;
  based_location?: Location | null;
  met_location?: Location | null;
  met_date?: MetDate | null;
  contacts: Contacts;
  notes: string;
}

export interface Person extends PersonInput {
  id: string;
}

interface PeopleResponse {
  revision: number;
  people: Person[];
}

interface PersonResponse {
  revision: number;
  person: Person;
}

export class RevisionConflictError extends Error {
  constructor() {
    super("Your data changed elsewhere. It has been reloaded.");
  }
}

const developmentUserId = "00000000-0000-4000-8000-000000000001";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (import.meta.env.DEV) {
    headers.set("X-Development-User", developmentUserId);
  }

  const response = await fetch(`/api${path}`, { ...options, headers });
  if (response.status === 409) {
    throw new RevisionConflictError();
  }
  if (!response.ok) {
    throw new Error("Unable to save your changes. Please try again.");
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function getPeople(): Promise<PeopleResponse> {
  return request<PeopleResponse>("/people");
}

export async function createPerson(
  person: PersonInput,
  expectedRevision: number,
): Promise<PersonResponse> {
  return request<PersonResponse>("/people", {
    method: "POST",
    body: JSON.stringify({ expected_revision: expectedRevision, person }),
  });
}

export async function updatePerson(
  id: string,
  person: PersonInput,
  expectedRevision: number,
): Promise<PersonResponse> {
  return request<PersonResponse>(`/people/${id}`, {
    method: "PUT",
    body: JSON.stringify({ expected_revision: expectedRevision, person }),
  });
}

export async function deletePerson(
  id: string,
  expectedRevision: number,
): Promise<void> {
  await request<void>(`/people/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ expected_revision: expectedRevision }),
  });
}
