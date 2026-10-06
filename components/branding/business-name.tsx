"use client";

import { useBranding } from "./branding-provider";

// The business name and ABN from the Branding page, as on every legal line.
export function BusinessName() {
  const { legalName, abn } = useBranding();
  return (
    <>
      {legalName}, ABN {abn}
    </>
  );
}
