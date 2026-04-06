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

/** Abstraction over a package's file tree — works for both disk and in-memory. */
export interface PackageFileSystem {
  /** List all file paths relative to the package root. */
  listFiles(): Promise<string[]>;
  /** Read a file as a UTF-8 string. */
  readText(path: string): Promise<string>;
  /** Read a file as raw bytes. */
  readBytes(path: string): Promise<Uint8Array>;
  /** Get file size in bytes. */
  fileSize(path: string): Promise<number>;
  /** Check if the file has an executable permission bit (POSIX only, returns false on non-POSIX). */
  isExecutable(path: string): Promise<boolean>;
}
