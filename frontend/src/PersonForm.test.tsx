import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PersonForm } from "./PersonForm";

afterEach(() => {
  cleanup();
});

describe("PersonForm", () => {
  it("shows field errors and prevents saving an invalid partial met date", () => {
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

    expect(screen.getByText("Enter a year.")).toBeTruthy();
    expect(screen.getByText("Month must be 1–12.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save person" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save person" }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
