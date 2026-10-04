// Display labels for equipment condition. No imports, so client components can use it.
export const EQUIPMENT_TEXT = { OPERATIONAL: "Working", WARNING: "Needs a look", OFFLINE: "Out of action" } as const;
export const EQUIPMENT_TONE = { OPERATIONAL: "good", WARNING: "warn", OFFLINE: "bad" } as const;
