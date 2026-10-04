import { memberRoute, json } from "@/lib/http/route";
import { bookMember, cancelBooking } from "@/lib/classes/service";

// A member books or cancels only their own place; the member ID comes from
// the session.
export const POST = memberRoute({}, async ({ params, db, member }) => {
  const booking = await bookMember(db, member, params.id, member.id);
  return json({ id: booking.id, usedCredit: booking.usedCredit }, 201);
});

export const DELETE = memberRoute({}, async ({ params, db, member }) => {
  const result = await cancelBooking(db, member, params.id, member.id);
  return json({ late: result.late, creditReturned: result.creditReturned });
});
