import { z } from "zod";
import type { Status } from "@prisma/client";
import { zEmail, zId, zName } from "@/lib/http/route";

const zLocationId = z.string().min(1).max(40);

export const MEMBER_STATUSES = ["ACTIVE", "PAUSED", "PAST_DUE", "CANCELED", "PENDING"] as const satisfies readonly Status[];

export const MemberListQuery = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(MEMBER_STATUSES).optional(),
  planId: zId.optional(),
  archived: z.enum(["only", "include", "exclude"]).default("exclude"),
  take: z.coerce.number().int().min(1).max(500).default(200),
  cursor: zId.optional(),
  // Members whose home location this is (D-125).
  locationId: zLocationId.optional(),
  // Sorted in the database, so a capped list keeps the right members: the
  // most at-risk for retention, A to Z for pickers (R-94).
  sort: z.enum(["newest", "name", "retention"]).default("newest"),
});

export const CreateMemberBody = z.object({
  name: zName,
  email: zEmail,
  planId: zId.nullable().optional(),
  referredById: zId.nullable().optional(),
  homeLocationId: zLocationId.optional(),
});

export const UpdateMemberBody = z
  .object({
    name: zName.optional(),
    email: zEmail.optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    referredById: zId.nullable().optional(),
    keycardIssued: z.boolean().optional(),
    planId: zId.nullable().optional(),
    status: z.enum(MEMBER_STATUSES).optional(),
    homeLocationId: zLocationId.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, "Nothing to update");

export const ProfileBody = z
  .object({
    name: zName.optional(),
    notifyAnnouncements: z.boolean().optional(),
    notifyWaitlist: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change" });

export type MemberListInput = z.infer<typeof MemberListQuery>;
export type CreateMemberInput = z.infer<typeof CreateMemberBody>;
export type UpdateMemberInput = z.infer<typeof UpdateMemberBody>;
export type ProfileInput = z.infer<typeof ProfileBody>;
