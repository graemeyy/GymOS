// Display labels for database enums. Australian spelling.
export const STATUS_TEXT = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  PAST_DUE: "Past due",
  CANCELED: "Cancelled",
  PENDING: "Not started",
} as const;

export type MemberStatus = keyof typeof STATUS_TEXT;

export const STATUS_TONE = {
  ACTIVE: "good",
  PAUSED: "neutral",
  PAST_DUE: "bad",
  CANCELED: "neutral",
  PENDING: "warn",
} as const;

export const EQUIPMENT_TEXT = { OPERATIONAL: "Working", WARNING: "Needs a look", OFFLINE: "Out of action" } as const;
export const EQUIPMENT_TONE = { OPERATIONAL: "good", WARNING: "warn", OFFLINE: "bad" } as const;
