import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above imports, so shared test doubles must go
// through vi.hoisted to be safely referenced from the factory.
const { invokeMock, captureMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  captureMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

vi.mock("@/lib/errorReporting", () => ({
  captureException: captureMock,
}));

import { safeInvoke } from "@/lib/safeInvoke";

describe("safeInvoke", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    captureMock.mockReset();
  });

  it("invokes the edge function with the given body and resolves quietly on success", async () => {
    invokeMock.mockResolvedValue({ data: null, error: null });
    await safeInvoke("send-notification", { body: { trigger_key: "x", submission_id: "s1" } });
    expect(invokeMock).toHaveBeenCalledWith("send-notification", {
      body: { trigger_key: "x", submission_id: "s1" },
    });
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("reports structured context when the invocation returns an error", async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await safeInvoke("send-notification", {
      body: { trigger_key: "x" },
      context: { from: "unit-test" },
    });
    expect(captureMock).toHaveBeenCalledTimes(1);
    const [err, ctx] = captureMock.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("send-notification");
    expect(ctx.function).toBe("send-notification");
    expect(ctx.from).toBe("unit-test");
  });

  it("never throws even if invoke itself rejects", async () => {
    invokeMock.mockRejectedValue(new Error("network"));
    await expect(
      safeInvoke("send-notification", { body: { trigger_key: "x" } }),
    ).resolves.toBeUndefined();
    expect(captureMock).toHaveBeenCalledTimes(1);
  });
});
