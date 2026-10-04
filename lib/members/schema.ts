import { z } from "zod";
import type { Status } from "@prisma/client";
import { zEmail, zId, zName } from "@/lib/http/route";

export const MEMBER_STATUSES = ["ACTIVE", "PAUSED", "PAST_DUE", "CANCELED", "PENDING"] as const satisfies readonly Status[];

export const MemberListQuery = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(MEMBER_STATUSES).optional(),
  planId: zId.optional(),
  archived: z.enum(["only", "include", "exclude"]).default("exclude"),
  take: z.coerce.number().int().min(1).max(500).default(200),
  cursor: zId.optional(),
});

export const CreateMemberBody = z.object({
  name: zName,
  email: zEmail,
  planId: zId.nullable().optional(),
  referredById: zId.nullable().optional(),
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
