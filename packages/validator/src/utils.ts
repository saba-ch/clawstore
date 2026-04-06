/** Extract file extension including the dot, e.g. ".md", ".json". */
export function extname(filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  if (lastDot <= lastSlash + 1 || lastDot === -1) return "";
  return filePath.slice(lastDot);
}

/** Check if a file extension indicates a text-readable format. */
export function isTextFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return [
    ".md",
    ".markdown",
    ".txt",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".csv",
    ".tsv",
  ].includes(ext);
}
