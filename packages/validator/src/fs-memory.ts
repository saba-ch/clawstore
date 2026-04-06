import type { PackageFileSystem } from "./types.js";

export interface MemoryFile {
  path: string;
  data: Uint8Array;
}

/** PackageFileSystem implementation backed by in-memory file entries (for API tarball extraction). */
export function createMemoryFs(files: MemoryFile[]): PackageFileSystem {
  const fileMap = new Map<string, Uint8Array>();
  for (const f of files) {
    fileMap.set(f.path, f.data);
  }

  return {
    async listFiles(): Promise<string[]> {
      return Array.from(fileMap.keys());
    },

    async readText(path: string): Promise<string> {
      const data = fileMap.get(path);
      if (!data) throw new Error(`File not found: ${path}`);
      return new TextDecoder().decode(data);
    },

    async readBytes(path: string): Promise<Uint8Array> {
      const data = fileMap.get(path);
      if (!data) throw new Error(`File not found: ${path}`);
      return data;
    },

    async fileSize(path: string): Promise<number> {
      const data = fileMap.get(path);
      if (!data) throw new Error(`File not found: ${path}`);
      return data.byteLength;
    },

    async isExecutable(): Promise<boolean> {
      // In-memory files have no permission bits; the executable check
      // relies on extension + magic bytes instead.
      return false;
    },
  };
}
