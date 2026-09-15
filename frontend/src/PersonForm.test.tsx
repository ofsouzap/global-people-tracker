import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PersonForm } from "./PersonForm";

afterEach(() => {
  cleanup();
});

describe("PersonForm", () => {
  it("uses native validation to prevent saving an invalid partial met date", () => {
    const onSave = vi.fn();
    render(
      <PersonForm
        person={null}
        onSave={onSave}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const [nameInput] = screen.getAllByRole("textbox");
    fireEvent.change(nameInput, { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Month"), {
      target: { value: "13" },
    });

    expect(
      (screen.getByLabelText("Met year") as HTMLInputElement).validity.valid,
    ).toBe(false);
    expect(
      (screen.getByLabelText("Month") as HTMLInputElement).validity.valid,
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Save person" }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps an edit form open and its date unchanged when date validation fails", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <PersonForm
        person={{
          id: "person-id",
          name: "Ada",
          met_date: { year: 2024, month: 2, day: 29 },
          contacts: { others: [] },
          notes: "",
        }}
        onSave={onSave}
        onDelete={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save person" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Month").getAttribute("aria-invalid")).toBe(
        "true",
      ),
    );
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
