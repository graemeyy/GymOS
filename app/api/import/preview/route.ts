import { staffRoute, json } from "@/lib/http/route";
import { ImportPreviewBody, MAX_IMPORT_BYTES } from "@/lib/import/schema";
import { previewImport } from "@/lib/import/service";

// The file's headings, a few rows and a first guess at the column mapping
// (D-130). Nothing is saved.
export const POST = staffRoute({ permission: "data.import", body: ImportPreviewBody, maxBodyBytes: MAX_IMPORT_BYTES + 64 * 1024 }, async ({ body }) => json(previewImport(body.kind, body.csv)));
