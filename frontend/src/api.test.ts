import { describe, expect, it, vi } from "vitest";
import { deletePerson } from "./api";

describe("deletePerson", () => {
  it("accepts an empty successful response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(deletePerson("person-id", 2)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });
});
