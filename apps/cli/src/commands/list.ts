import { Command } from "commander";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfigDir } from "../lib/config.js";

export const listCommand = new Command("list")
  .description("List installed agents")
  .action(async () => {
    const configDir = await getConfigDir();
    const installsDir = join(configDir, "installs");

    let files: string[];
    try {
      files = await readdir(installsDir);
    } catch {
      console.log("No agents installed.");
      return;
    }

    const records = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(installsDir, file), "utf-8");
        records.push(JSON.parse(raw));
      } catch {
        // Skip corrupt files
      }
    }

    if (records.length === 0) {
      console.log("No agents installed.");
      return;
    }

    console.log(`\n  Installed agents:\n`);
    for (const r of records) {
      console.log(`  ${r.id}@${r.version}  (${r.updatePolicy})`);
      console.log(`    ${r.workspacePath}\n`);
    }
  });
