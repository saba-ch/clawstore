import type { Finding, ValidationResult, PackageFileSystem } from "./types.js";
import {
  checkSchema,
  checkEntrypoints,
  checkFileExtension,
  checkExecutableBit,
  checkBinaryMagic,
  checkSecrets,
  checkTotalSize,
  checkFileCount,
  checkFileSize,
  checkStoreAssets,
} from "./checks.js";
import { isTextFile } from "./utils.js";

/**
 * Run all validation checks against a package using the given filesystem abstraction.
 * Returns structured findings split into errors and warnings.
 */
export async function runValidation(
  manifestData: unknown,
  fs: PackageFileSystem
): Promise<ValidationResult> {
  const errors: Finding[] = [];
  const warnings: Finding[] = [];

  const push = (f: Finding | null) => {
    if (!f) return;
    if (f.severity === "error") errors.push(f);
    else warnings.push(f);
  };

  // 1. Schema validation
  const { findings: schemaFindings, parsed: manifest } = checkSchema(manifestData);
  errors.push(...schemaFindings);

  if (!manifest) {
    return { valid: false, errors, warnings };
  }

  // 2. List all files
  const files = await fs.listFiles();

  // 3. File count check
  push(checkFileCount(files.length));

  // 4. Entrypoint + template verification
  const entrypointFindings = await checkEntrypoints(manifest, fs);
  errors.push(...entrypointFindings);

  // 5. Store asset verification
  const storeFindings = await checkStoreAssets(manifest, fs);
  warnings.push(...storeFindings);

  // 6. Per-file checks
  let totalSize = 0;

  for (const filePath of files) {
    const size = await fs.fileSize(filePath);
    totalSize += size;

    // Extension check
    push(checkFileExtension(filePath));

    // File size check
    push(checkFileSize(filePath, size));

    // Executable permission bit
    push(await checkExecutableBit(filePath, fs));

    // Binary magic bytes (read first 4 bytes)
    const header = await fs.readBytes(filePath);
    push(checkBinaryMagic(filePath, header.slice(0, 8)));

    // Secret scan on text files
    if (isTextFile(filePath)) {
      const content = await fs.readText(filePath);
      const secretFindings = checkSecrets(filePath, content);
      errors.push(...secretFindings);
    }
  }

  // 7. Total package size
  push(checkTotalSize(totalSize));

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
