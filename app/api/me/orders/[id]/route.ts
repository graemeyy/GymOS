import { memberRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { gym } from "@/lib/config";
import { getOrderForMember } from "@/lib/shop/queries";
import { getBranding } from "@/lib/branding/service";

// One of the member's own orders. Another member's order answers "not found".
// Staff notes on status changes are internal, so only statuses and times are
// shown, plus the tracking number.
export const GET = memberRoute({}, async ({ params, db, member }) => {
  const order = await getOrderForMember(db, member.id, params.id);
  if (!order) throw new ApiError("not_found", "Order not found.");
  return json({ ...order, pickupAddress: (await getBranding(db)).address, changeOfMindReturnsDays: gym.policies.shop.changeOfMindReturnsDays });
});
