// Shared validation library for agent packages.
// Used by both CLI (clawstore validate) and API (POST /v1/publish).
// Full implementation in Phase 4.

export interface Finding {
  code: string;
  message: string;
  path?: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: Finding[];
  warnings: Finding[];
}

export async function validate(_packageDir: string): Promise<ValidationResult> {
  return { valid: true, errors: [], warnings: [] };
}
