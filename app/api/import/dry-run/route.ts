import { staffRoute, json } from "@/lib/http/route";
import { ImportDryRunBody, MAX_IMPORT_BYTES } from "@/lib/import/schema";
import { dryRunImport } from "@/lib/import/service";

// Checks every row and says what an import would do. Nothing is saved.
export const POST = staffRoute({ permission: "data.import", body: ImportDryRunBody, maxBodyBytes: MAX_IMPORT_BYTES + 64 * 1024 }, async ({ db, staff, body }) => json(await dryRunImport(db, staff, body)));
