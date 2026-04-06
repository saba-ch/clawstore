import { Command } from "commander";
import { resolve, join } from "node:path";
import { readFile, stat } from "node:fs/promises";
import { validate } from "@clawstore/validator";
import { glob } from "glob";
import * as tar from "tar";
import { tmpdir } from "node:os";
import { getAuthenticatedClient } from "../lib/client.js";
import type { AgentManifest } from "@clawstore/schema";

export const publishCommand = new Command("publish")
  .description("Validate, pack, and publish an agent to the registry")
  .argument("[path]", "Package directory path", ".")
  .action(async (path: string) => {
    const dir = resolve(path);
    const client = await getAuthenticatedClient();

    // 1. Validate
    console.log("Validating...");
    const result = await validate(dir);
    if (!result.valid) {
      for (const e of result.errors) {
        console.error(`  ERROR  ${e.code}: ${e.message}`);
      }
      console.error("\nValidation failed. Fix errors before publishing.");
      process.exit(1);
    }
    if (result.warnings.length > 0) {
      for (const w of result.warnings) {
        console.warn(`  WARN   ${w.code}: ${w.message}`);
      }
    }
    console.log("Validation passed.\n");

    // 2. Read manifest
    const manifestRaw = await readFile(join(dir, "agent.json"), "utf-8");
    const manifest: AgentManifest = JSON.parse(manifestRaw);

    // 3. Pack tarball (agent content only, exclude store/ assets)
    const allFiles = new Set<string>();
    allFiles.add("agent.json");
    for (const pattern of manifest.files) {
      const matches = await glob(pattern, { cwd: dir, nodir: true });
      for (const m of matches) allFiles.add(m);
    }

    const tarballPath = join(tmpdir(), `clawstore-publish-${Date.now()}.tgz`);
    await tar.create(
      { gzip: true, file: tarballPath, cwd: dir },
      Array.from(allFiles)
    );
    const tarballBuffer = await readFile(tarballPath);

    // 4. Build multipart form
    const form = new FormData();
    form.append("metadata", JSON.stringify(manifest));
    form.append(
      "tarball",
      new Blob([tarballBuffer], { type: "application/gzip" }),
      "package.tgz"
    );

    // 5. Attach store assets as separate form parts
    if (manifest.store?.icon) {
      try {
        const iconData = await readFile(join(dir, manifest.store.icon));
        form.append("icon", new Blob([iconData]), manifest.store.icon);
      } catch {
        console.warn(`  WARN   Store icon "${manifest.store.icon}" not found, skipping.`);
      }
    }
    if (manifest.store?.screenshots) {
      for (let i = 0; i < manifest.store.screenshots.length; i++) {
        const ssPath = manifest.store.screenshots[i];
        // Resolve glob patterns for screenshots
        const matches = await glob(ssPath, { cwd: dir, nodir: true });
        for (const match of matches) {
          try {
            const ssData = await readFile(join(dir, match));
            form.append(`screenshot-${i}`, new Blob([ssData]), match);
          } catch {
            console.warn(`  WARN   Screenshot "${match}" not found, skipping.`);
          }
        }
      }
    }

    // 6. Publish
    console.log(`Publishing ${manifest.id}@${manifest.version}...`);
    try {
      const res = await client.publish(form);
      console.log(`\nPublished ${res.id}@${res.version}`);
      console.log(`  Channel: ${res.channel}`);
      console.log(`  SHA-256: ${res.tarballSha256}`);
      console.log(`  Size:    ${(res.tarballSizeBytes / 1024).toFixed(1)} KB`);
    } catch (err: any) {
      console.error(`\nPublish failed: ${err.message}`);
      process.exit(1);
    }
  });
