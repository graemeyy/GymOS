import { memberRoute } from "@/lib/http/route";
import { exportMemberData } from "@/lib/members/account";

// A copy of everything held about the member, as a JSON download.
export const GET = memberRoute({}, async ({ db, member }) => {
  const data = await exportMemberData(db, member);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-gym-data-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
