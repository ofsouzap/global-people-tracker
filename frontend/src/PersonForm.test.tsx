import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
});
