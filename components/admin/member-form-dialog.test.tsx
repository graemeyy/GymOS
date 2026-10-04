// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemberFormDialog, type EditableMember } from "./member-form-dialog";

afterEach(cleanup);

const member: EditableMember = {
  id: "m1",
  name: "Alex Example",
  email: "alex@example.com",
  status: "ACTIVE",
  planId: "old",
  membershipPlan: { id: "old", name: "Founders" },
};
const noop = () => undefined;

describe("R-56 editing a member", () => {
  it("keeps what staff typed when the parent re-renders with a new plans list", () => {
    const { rerender } = render(<MemberFormDialog open member={member} plans={[]} onClose={noop} onSaved={noop} />);
    const name = screen.getByLabelText(/Full name/) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Alex Changed" } });
    rerender(<MemberFormDialog open member={{ ...member }} plans={[{ id: "p1", name: "Monthly" }]} onClose={noop} onSaved={noop} />);
    expect((screen.getByLabelText(/Full name/) as HTMLInputElement).value).toBe("Alex Changed");
  });

  it("shows a retired plan instead of 'No plan'", () => {
    render(<MemberFormDialog open member={member} plans={[{ id: "p1", name: "Monthly" }]} onClose={noop} onSaved={noop} />);
    const plan = screen.getByLabelText(/Plan/) as HTMLSelectElement;
    expect(plan.value).toBe("old");
    expect(plan.selectedOptions[0].textContent).toBe("Founders (retired)");
  });
});
