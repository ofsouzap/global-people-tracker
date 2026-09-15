import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function peopleResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      revision: 2,
      people: [
        {
          id: "1",
          name: "Ada",
          based_location: { country: "Australia", city: "Sydney" },
          contacts: { others: [] },
          notes: "",
        },
        { id: "2", name: "Lin", contacts: { others: [] }, notes: "" },
      ],
    }),
  };
}

describe("App", () => {
  it("separates people without a based location and filters the list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(peopleResponse()));
    render(<App />);

    expect(await screen.findByText("Ada")).toBeTruthy();
    expect(screen.getByText("No based location")).toBeTruthy();
    expect(screen.getByText("Lin")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search people"), {
      target: { value: "ada" },
    });
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.queryByText("Lin")).toBeNull();
  });

  it("trims searches and hides the no-location section when it has no people", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(peopleResponse()));
    render(<App />);

    await screen.findByText("Ada");
    fireEvent.change(screen.getByLabelText("Search people"), {
      target: { value: " Ada " },
    });

    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.queryByText("No based location")).toBeNull();
  });

  it("updates a person without including its id in the request body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(peopleResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          revision: 3,
          person: {
            id: "1",
            name: "Ada Lovelace",
            based_location: { country: "Australia", city: "Sydney" },
            contacts: { others: [] },
            notes: "",
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByText("Ada"));
    const dialog = await screen.findByRole("dialog", { hidden: true });
    const [nameInput] = within(dialog).getAllByRole("textbox");
    fireEvent.change(nameInput, {
      target: { value: "Ada Lovelace" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save person" }),
    );

    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());
    const [, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(request.method).toBe("PUT");
    expect(JSON.parse(request.body as string).person).not.toHaveProperty("id");
  });
});
