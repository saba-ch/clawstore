import type { ValidationResult } from "./types.js";
import { createMemoryFs, type MemoryFile } from "./fs-memory.js";
import { runValidation } from "./runner.js";

/**
 * Validate a package from in-memory file entries.
 * Used by the API (`POST /v1/publish`) after extracting the tarball.
 */
export async function validateBuffer(
  manifestData: unknown,
  files: MemoryFile[]
): Promise<ValidationResult> {
  const fs = createMemoryFs(files);
  return runValidation(manifestData, fs);
}

export type { MemoryFile };
