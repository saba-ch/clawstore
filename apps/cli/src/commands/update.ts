import { Command } from "commander";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getClient } from "../lib/client.js";
import { getConfigDir } from "../lib/config.js";

export const updateCommand = new Command("update")
  .description("Check for and apply agent updates")
  .argument("[id]", "Agent ID to update (omit for all)")
  .option("--check", "Dry run — show available updates, don't install")
  .action(async (id: string | undefined, opts) => {
    const configDir = await getConfigDir();
    const installsDir = join(configDir, "installs");

    let files: string[];
    try {
      files = await readdir(installsDir);
    } catch {
      console.log("No agents installed.");
      return;
    }

    // Load install records
    const installs: Array<{ id: string; version: string; name: string }> = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(installsDir, file), "utf-8");
        const record = JSON.parse(raw);
        if (!id || record.id === id || record.id === `@${id.replace(/^@/, "")}`) {
          installs.push({
            id: record.id,
            version: record.version,
            name: record.name,
          });
        }
      } catch {
        // Skip
      }
    }

    if (installs.length === 0) {
      console.log(id ? `Agent ${id} is not installed.` : "No agents installed.");
      return;
    }

    const client = await getClient();

    try {
      const result = await client.checkUpdates(installs);

      if (result.updates.length === 0) {
        console.log("All agents are up to date.");
        return;
      }

      console.log(`\n  Available updates:\n`);
      for (const u of result.updates) {
        const yanked = u.yanked ? " (current version yanked)" : "";
        console.log(`  ${u.id}: ${u.from} → ${u.to} (${u.channel})${yanked}`);
      }

      if (opts.check) {
        console.log(`\nRun \`clawstore update\` to install updates.`);
        return;
      }

      // TODO: implement actual update (download + atomic workspace swap)
      console.log(`\nUpdate application not yet implemented. Use \`clawstore install <id>@<version>\` for now.`);
    } catch (err: any) {
      const code = err.code ? `[${err.code}] ` : "";
      console.error(`Update check failed: ${code}${err.message}`);
      if (err.details) {
        console.error(`  Details: ${JSON.stringify(err.details)}`);
      }
      process.exit(1);
    }
  });
