// --- Size limits ---
export const MAX_PACKAGE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_FILE_COUNT = 10_000;
export const WARN_TEXT_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB
export const MAX_ASSET_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// --- Blocked executable extensions ---
export const BLOCKED_EXTENSIONS = new Set([
  ".sh",
  ".bash",
  ".zsh",
  ".js",
  ".ts",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".php",
  ".exe",
  ".bat",
  ".ps1",
  ".dll",
  ".so",
  ".dylib",
]);

// --- Allowed file extensions ---
export const ALLOWED_EXTENSIONS = new Set([
  // Text
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".csv",
  ".tsv",
  // Images
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".webp",
]);

// --- Secret patterns ---
// Patterns that indicate leaked secrets in file content.
export const SECRET_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  {
    name: "AWS Access Key",
    regex: /AKIA[0-9A-Z]{16}/,
  },
  {
    name: "AWS Secret Key",
    regex: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*[A-Za-z0-9/+=]{40}/,
  },
  {
    name: "OpenAI API Key",
    regex: /sk-[A-Za-z0-9]{20,}/,
  },
  {
    name: "Anthropic API Key",
    regex: /sk-ant-[A-Za-z0-9-]{20,}/,
  },
  {
    name: "Generic API Key assignment",
    regex: /[A-Z_]+_API_KEY\s*[=:]\s*["']?[A-Za-z0-9_\-]{16,}["']?/,
  },
  {
    name: "Generic Secret assignment",
    regex: /[A-Z_]+_SECRET\s*[=:]\s*["']?[A-Za-z0-9_\-/+=]{16,}["']?/,
  },
  {
    name: "Private Key block",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: "GitHub Token",
    regex: /gh[pousr]_[A-Za-z0-9_]{36,}/,
  },
];

// --- Binary magic bytes (executable formats) ---
export const EXECUTABLE_MAGIC: Array<{ name: string; bytes: number[] }> = [
  { name: "ELF", bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { name: "Mach-O (32-bit)", bytes: [0xfe, 0xed, 0xfa, 0xce] },
  { name: "Mach-O (64-bit)", bytes: [0xfe, 0xed, 0xfa, 0xcf] },
  { name: "Mach-O (reverse 32)", bytes: [0xce, 0xfa, 0xed, 0xfe] },
  { name: "Mach-O (reverse 64)", bytes: [0xcf, 0xfa, 0xed, 0xfe] },
  { name: "PE (Windows)", bytes: [0x4d, 0x5a] }, // MZ header
];
