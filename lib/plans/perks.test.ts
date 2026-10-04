import { describe, expect, it } from "vitest";
import { planPerks } from "./perks";

describe("planPerks", () => {
  it("describes credits, guest passes and the shop discount per billing period", () => {
    expect(planPerks({ classCreditsPerCycle: 8, guestPassesPerCycle: 1, shopDiscountPercent: 10 }, "MONTH")).toEqual(["8 classes per month", "1 guest pass per month", "10% off in the shop"]);
    expect(planPerks({ classCreditsPerCycle: null, guestPassesPerCycle: 0, shopDiscountPercent: 0 }, "WEEK")).toEqual(["Unlimited classes"]);
    expect(planPerks({ classCreditsPerCycle: 0, guestPassesPerCycle: 0, shopDiscountPercent: 0 }, "WEEK")).toEqual(["Gym floor only"]);
  });

  it("adds the casual guest rate for staff", () => {
    expect(planPerks({ classCreditsPerCycle: 0, guestPassesPerCycle: 0, shopDiscountPercent: 0, guestRateCents: 2000 }, "WEEK", { includeGuestRate: true })).toEqual(["Gym floor only", "Guests $20.00"]);
  });
});
