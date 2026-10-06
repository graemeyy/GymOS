import { z } from "zod";
import { zEmail, zId, zName, zPassword } from "@/lib/http/route";

// The locations their role applies at; empty means every location (D-128).
const zLocationIds = z.array(z.string().min(1).max(40)).max(50);

export const InviteStaffBody = z.object({ name: zName, email: zEmail, roleId: zId, locationIds: zLocationIds.default([]) });

export const UpdateStaffBody = z
  .object({ name: zName.optional(), roleId: zId.optional(), active: z.boolean().optional(), locationIds: zLocationIds.optional() })
  .refine((b) => Object.keys(b).length > 0, "Nothing to update");

export const AcceptInviteBody = z.object({ token: z.string().min(20).max(200), password: zPassword });

export const ChangeOwnPasswordBody = z.object({ currentPassword: z.string().min(1).max(200), newPassword: zPassword });

export const StaffSignInBody = z.object({ email: zEmail, password: z.string().min(1).max(200) });

export const BootstrapBody = z.object({ name: zName, email: zEmail, password: zPassword, setupToken: z.string().max(200).optional() });

export type InviteStaffInput = z.infer<typeof InviteStaffBody>;
export type UpdateStaffInput = z.infer<typeof UpdateStaffBody>;
export type FirstOwnerInput = Omit<z.infer<typeof BootstrapBody>, "setupToken">;
