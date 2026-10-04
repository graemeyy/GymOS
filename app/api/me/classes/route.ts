import { memberRoute, json } from "@/lib/http/route";
import { gym } from "@/lib/config";
import { MemberTimetableQuery } from "@/lib/classes/schema";
import { listClassesForMember } from "@/lib/classes/queries";

export const GET = memberRoute({ query: MemberTimetableQuery }, async ({ query, db, member }) => {
  const classes = await listClassesForMember(db, member.id, query);
  return json({
    bookingOpensDaysAhead: gym.policies.classes.bookingOpensDaysAhead,
    cancelWithoutPenaltyHours: gym.policies.classes.cancelWithoutPenaltyHours,
    lateCancelForfeitsCredit: gym.policies.classes.lateCancelForfeitsCredit,
    classes,
  });
});
