// No imports, so browser code can use these too.

/** The location every gym has from the migration (D-125). Rows that don't
 * say where they belong default to it, and it can't be archived. */
export const MAIN_LOCATION_ID = "main";

export const LOCATION_ACCESS = ["HOME", "SELECTED", "ALL"] as const;
export type LocationAccessName = (typeof LOCATION_ACCESS)[number];

export const LOCATION_ACCESS_TEXT: Record<LocationAccessName, string> = {
  HOME: "Their home location only",
  SELECTED: "Chosen locations",
  ALL: "Every location",
};
