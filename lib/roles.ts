export type StaffRoleName = "OWNER" | "MANAGER" | "FRONT_DESK";

const ROLE_RANK: Record<StaffRoleName, number> = {
  FRONT_DESK: 0,
  MANAGER: 1,
  OWNER: 2,
};

export function hasRole(role: StaffRoleName | undefined | null, min: StaffRoleName): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const ROLE_LABELS: Record<StaffRoleName, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  FRONT_DESK: "Front desk",
};
