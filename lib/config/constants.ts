// Lists the config schema and browser code both use. No imports, so the
// browser doesn't bundle Zod for them (R-62).
export const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const BILLING_INTERVALS = ["WEEK", "FORTNIGHT", "MONTH", "YEAR"] as const;
