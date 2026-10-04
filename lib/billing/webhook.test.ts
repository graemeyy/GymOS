import { describe, expect, it } from "vitest";
import { statusFromSubscription } from "./webhook";

describe("statusFromSubscription", () => {
  it("maps Stripe statuses to member statuses", () => {
    expect(statusFromSubscription({ status: "active", pause_collection: null })).toBe("ACTIVE");
    expect(statusFromSubscription({ status: "past_due", pause_collection: null })).toBe("PAST_DUE");
    expect(statusFromSubscription({ status: "unpaid", pause_collection: null })).toBe("PAST_DUE");
    expect(statusFromSubscription({ status: "canceled", pause_collection: null })).toBe("CANCELED");
    expect(statusFromSubscription({ status: "incomplete", pause_collection: null })).toBeNull();
  });
  it("treats paused collection as paused", () => {
    expect(statusFromSubscription({ status: "active", pause_collection: { behavior: "void", resumes_at: null } })).toBe("PAUSED");
  });
});
