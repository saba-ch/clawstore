import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ValidationResult } from "./types.js";
import { createDiskFs } from "./fs-disk.js";
import { runValidation } from "./runner.js";

/**
 * Validate a package directory on disk.
 * Used by the CLI (`clawstore validate`).
 */
export async function validate(packageDir: string): Promise<ValidationResult> {
  // Read and parse agent.json
  let manifestData: unknown;
  try {
    const raw = await readFile(join(packageDir, "agent.json"), "utf-8");
    manifestData = JSON.parse(raw);
  } catch {
    return {
      valid: false,
      errors: [
        {
          code: "manifest_read_error",
          message: "Could not read or parse agent.json in the package directory",
          path: "agent.json",
          severity: "error",
        },
      ],
      warnings: [],
    };
  }

  const fs = createDiskFs(packageDir);
  return runValidation(manifestData, fs);
}
