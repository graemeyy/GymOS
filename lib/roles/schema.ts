import { z } from "zod";
import { zName } from "@/lib/http/route";
import { PERMISSIONS } from "@/lib/auth/permissions";

const Permissions = z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length).transform((list) => [...new Set(list)]);

export const CreateRoleBody = z.object({
  name: zName,
  description: z.string().trim().max(300).nullable().optional(),
  permissions: Permissions,
});

export const UpdateRoleBody = z
  .object({ name: zName.optional(), description: z.string().trim().max(300).nullable().optional(), permissions: Permissions.optional() })
  .refine((b) => Object.keys(b).length > 0, "Nothing to update");

export type CreateRoleInput = z.infer<typeof CreateRoleBody>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleBody>;
