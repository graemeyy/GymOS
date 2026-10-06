import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { searchForCheckIn } from "@/lib/checkin/queries";

const Query = z.object({ q: z.string().trim().min(2, "Type at least two letters").max(100) });

// Finding a member by name when their pass won't scan (D-119).
export const GET = staffRoute({ permission: "checkin.scan", query: Query }, async ({ db, query }) => json(await searchForCheckIn(db, query.q)));
