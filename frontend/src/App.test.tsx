import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
});
