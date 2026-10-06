import { z } from "zod";
import { IMPORT_KINDS } from "./fields";

// A CSV up to 2 MB (a few thousand members) travels as text in the request.
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

const Upload = {
  kind: z.enum(IMPORT_KINDS),
  fileName: z.string().trim().min(1).max(200),
  csv: z.string().min(1, "Choose a CSV file").max(MAX_IMPORT_BYTES, "The file is over 2 MB. Split it into smaller files."),
};

export const ImportPreviewBody = z.object(Upload);

// Which column (by position) holds each field; null when it isn't in the file.
const Mapping = z.record(z.string().max(40), z.number().int().min(0).max(500).nullable());

export const ImportDryRunBody = z.object({ ...Upload, mapping: Mapping });

// The run has to quote what the dry run of exactly this file and mapping
// returned (D-130).
export const ImportRunBody = z.object({ ...Upload, mapping: Mapping, confirm: z.string().min(20).max(200) });

export type ImportDryRunInput = z.infer<typeof ImportDryRunBody>;
export type ImportRunInput = z.infer<typeof ImportRunBody>;
