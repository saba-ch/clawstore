import { Command } from "commander";
import { resolve, join, basename } from "node:path";
import { readFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { validate } from "@clawstore/validator";
import * as tar from "tar";
import { glob } from "glob";
import type { AgentManifest } from "@clawstore/schema";

export const packCommand = new Command("pack")
  .description("Create a tarball from an agent package directory")
  .argument("[path]", "Package directory path", ".")
  .action(async (path: string) => {
    const dir = resolve(path);

    // Validate first
    console.log("Validating...");
    const result = await validate(dir);
    if (!result.valid) {
      for (const e of result.errors) {
        console.error(`  ERROR  ${e.code}: ${e.message}`);
      }
      console.error("\nValidation failed. Fix errors before packing.");
      process.exit(1);
    }

    // Read manifest for the output filename
    const manifestRaw = await readFile(join(dir, "agent.json"), "utf-8");
    const manifest: AgentManifest = JSON.parse(manifestRaw);

    // Resolve files from the files globs
    const allFiles = new Set<string>();
    allFiles.add("agent.json");

    for (const pattern of manifest.files) {
      const matches = await glob(pattern, { cwd: dir, nodir: true });
      for (const m of matches) allFiles.add(m);
    }

    // Build tarball
    const idParts = manifest.id.replace("@", "").replace("/", "-");
    const tarballName = `${idParts}-${manifest.version}.tgz`;
    const tarballPath = join(dir, tarballName);

    await tar.create(
      {
        gzip: true,
        file: tarballPath,
        cwd: dir,
      },
      Array.from(allFiles)
    );

    console.log(`Packed ${allFiles.size} files → ${tarballName}`);
  });
