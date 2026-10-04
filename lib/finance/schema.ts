import { z } from "zod";
import { RangeQuery } from "./range";

export const ExportQuery = RangeQuery.extend({ type: z.enum(["summary", "payments", "refunds"]).default("summary") });
