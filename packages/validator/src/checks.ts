import { validateManifestSchema, type AgentManifest } from "@clawstore/schema";
import type { Finding, PackageFileSystem } from "./types.js";
import {
  BLOCKED_EXTENSIONS,
  ALLOWED_EXTENSIONS,
  SECRET_PATTERNS,
  EXECUTABLE_MAGIC,
  MAX_PACKAGE_SIZE_BYTES,
  MAX_FILE_COUNT,
  WARN_TEXT_FILE_SIZE_BYTES,
  MAX_ASSET_FILE_SIZE_BYTES,
} from "./constants.js";
import { extname } from "./utils.js";

// ── Schema validation ──────────────────────────────────────

export function checkSchema(manifest: unknown): {
  findings: Finding[];
  parsed: AgentManifest | null;
} {
  const result = validateManifestSchema(manifest);
  if (result.valid) {
    return { findings: [], parsed: manifest as AgentManifest };
  }

  return {
    findings: result.errors.map((e) => ({
      code: "schema_error",
      message: `${e.path}: ${e.message}`,
      severity: "error" as const,
    })),
    parsed: null,
  };
}

// ── Entrypoint verification ────────────────────────────────

export async function checkEntrypoints(
  manifest: AgentManifest,
  fs: PackageFileSystem
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const files = new Set(await fs.listFiles());

  for (const [target, source] of Object.entries(manifest.openclaw.entrypoints)) {
    if (!files.has(source)) {
      findings.push({
        code: "entrypoint_missing",
        message: `Entrypoint "${target}" points to "${source}" which does not exist in the package`,
        path: source,
        severity: "error",
      });
    }
  }

  if (manifest.openclaw.templates) {
    for (const [target, source] of Object.entries(manifest.openclaw.templates)) {
      if (!files.has(source)) {
        findings.push({
          code: "template_missing",
          message: `Template "${target}" points to "${source}" which does not exist in the package`,
          path: source,
          severity: "error",
        });
      }
    }
  }

  return findings;
}

// ── File type + extension checks ───────────────────────────

export function checkFileExtension(filePath: string): Finding | null {
  const ext = extname(filePath).toLowerCase();

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return {
      code: "blocked_extension",
      message: `File has blocked executable extension "${ext}"`,
      path: filePath,
      severity: "error",
    };
  }

  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    return {
      code: "unknown_extension",
      message: `File has unrecognized extension "${ext}" — only markdown, JSON, YAML, TOML, CSV, text, and images are allowed`,
      path: filePath,
      severity: "warning",
    };
  }

  return null;
}

// ── Executable permission bit check ────────────────────────

export async function checkExecutableBit(
  filePath: string,
  fs: PackageFileSystem
): Promise<Finding | null> {
  if (await fs.isExecutable(filePath)) {
    return {
      code: "executable_bit",
      message: "File has executable permission bit set",
      path: filePath,
      severity: "error",
    };
  }
  return null;
}

// ── Binary executable magic bytes ──────────────────────────

export function checkBinaryMagic(
  filePath: string,
  header: Uint8Array
): Finding | null {
  for (const { name, bytes } of EXECUTABLE_MAGIC) {
    if (header.length >= bytes.length && bytes.every((b, i) => header[i] === b)) {
      return {
        code: "executable_binary",
        message: `File appears to be a ${name} executable binary`,
        path: filePath,
        severity: "error",
      };
    }
  }
  return null;
}

// ── Secret scan ────────────────────────────────────────────

export function checkSecrets(
  filePath: string,
  content: string
): Finding[] {
  const findings: Finding[] = [];
  for (const { name, regex } of SECRET_PATTERNS) {
    if (regex.test(content)) {
      findings.push({
        code: "secret_detected",
        message: `Possible ${name} detected in file content`,
        path: filePath,
        severity: "error",
      });
    }
  }
  return findings;
}

// ── Size limit checks ──────────────────────────────────────

export function checkTotalSize(totalBytes: number): Finding | null {
  if (totalBytes > MAX_PACKAGE_SIZE_BYTES) {
    return {
      code: "package_too_large",
      message: `Total package size ${formatBytes(totalBytes)} exceeds limit of ${formatBytes(MAX_PACKAGE_SIZE_BYTES)}`,
      severity: "error",
    };
  }
  return null;
}

export function checkFileCount(count: number): Finding | null {
  if (count > MAX_FILE_COUNT) {
    return {
      code: "too_many_files",
      message: `Package contains ${count} files, exceeding the limit of ${MAX_FILE_COUNT}`,
      severity: "error",
    };
  }
  return null;
}

export function checkFileSize(filePath: string, sizeBytes: number): Finding | null {
  const ext = extname(filePath).toLowerCase();
  const isImage = [".png", ".jpg", ".jpeg", ".svg", ".webp"].includes(ext);

  if (isImage && sizeBytes > MAX_ASSET_FILE_SIZE_BYTES) {
    return {
      code: "asset_too_large",
      message: `Asset file ${formatBytes(sizeBytes)} exceeds limit of ${formatBytes(MAX_ASSET_FILE_SIZE_BYTES)}`,
      path: filePath,
      severity: "error",
    };
  }

  if (!isImage && sizeBytes > WARN_TEXT_FILE_SIZE_BYTES) {
    return {
      code: "text_file_large",
      message: `Text file ${formatBytes(sizeBytes)} exceeds recommended limit of ${formatBytes(WARN_TEXT_FILE_SIZE_BYTES)}`,
      path: filePath,
      severity: "warning",
    };
  }

  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
