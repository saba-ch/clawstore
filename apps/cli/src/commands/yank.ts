import { Command } from "commander";
import { getAuthenticatedClient } from "../lib/client.js";

export const yankCommand = new Command("yank")
  .description("Yank a published version")
  .argument("<id>", "Agent ID with version (@scope/name@version)")
  .option("-r, --reason <text>", "Reason for yanking")
  .action(async (id: string, opts) => {
    const match = id.replace(/^@/, "").match(/^([^/]+)\/([^@]+)@(.+)$/);
    if (!match) {
      console.error("Invalid format. Use @scope/name@version.");
      process.exit(1);
    }
    const [, scope, name, version] = match;
    const client = await getAuthenticatedClient();

    try {
      await client.yank(scope, name, version, opts.reason);
      console.log(`Yanked @${scope}/${name}@${version}`);
    } catch (err: any) {
      const code = err.code ? `[${err.code}] ` : "";
      console.error(`Yank failed: ${code}${err.message}`);
      if (err.details) {
        console.error(`  Details: ${JSON.stringify(err.details)}`);
      }
      process.exit(1);
    }
  });
