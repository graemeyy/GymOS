import { staffRoute, json } from "@/lib/http/route";
import { ImportRunBody, MAX_IMPORT_BYTES } from "@/lib/import/schema";
import { runImport } from "@/lib/import/service";

// Imports a file the dry run has checked, all or nothing (D-130).
export const POST = staffRoute({ permission: "data.import", body: ImportRunBody, maxBodyBytes: MAX_IMPORT_BYTES + 64 * 1024 }, async ({ db, staff, body }) => json(await runImport(db, staff, body), 201));
