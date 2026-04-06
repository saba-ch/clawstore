import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { PackageFileSystem } from "./types.js";

/** PackageFileSystem implementation backed by a real directory on disk. */
export function createDiskFs(rootDir: string): PackageFileSystem {
  return {
    async listFiles(): Promise<string[]> {
      const results: string[] = [];
      async function walk(dir: string) {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            results.push(relative(rootDir, fullPath));
          }
        }
      }
      await walk(rootDir);
      return results;
    },

    async readText(path: string): Promise<string> {
      return readFile(join(rootDir, path), "utf-8");
    },

    async readBytes(path: string): Promise<Uint8Array> {
      return readFile(join(rootDir, path));
    },

    async fileSize(path: string): Promise<number> {
      const s = await stat(join(rootDir, path));
      return s.size;
    },

    async isExecutable(path: string): Promise<boolean> {
      const s = await stat(join(rootDir, path));
      // Check if any execute bit is set (owner, group, or other)
      return (s.mode & 0o111) !== 0;
    },
  };
}
