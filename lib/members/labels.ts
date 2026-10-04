// Display labels for member statuses. No imports, so client components can use it.
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
