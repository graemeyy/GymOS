import { z } from "zod";
import { zEmail, zName, zPassword } from "@/lib/http/route";
import { STAFF_ROLES } from "@/lib/auth/permissions";

export const CreateStaffBody = z.object({ name: zName, email: zEmail, password: zPassword, role: z.enum(STAFF_ROLES) });

export const UpdateStaffBody = z
  .object({ name: zName.optional(), role: z.enum(STAFF_ROLES).optional(), password: zPassword.optional() })
  .refine((b) => Object.keys(b).length > 0, "Nothing to update");

export const ChangeOwnPasswordBody = z.object({ currentPassword: z.string().min(1).max(200), newPassword: zPassword });

export const StaffSignInBody = z.object({ email: zEmail, password: z.string().min(1).max(200) });

export const BootstrapBody = z.object({ name: zName, email: zEmail, password: zPassword, setupToken: z.string().max(200).optional() });

export type CreateStaffInput = z.infer<typeof CreateStaffBody>;
export type UpdateStaffInput = z.infer<typeof UpdateStaffBody>;
export type FirstOwnerInput = Omit<z.infer<typeof BootstrapBody>, "setupToken">;
