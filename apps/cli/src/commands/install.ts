import { Command } from "commander";
import { getClient } from "../lib/client.js";
import { installAgent } from "../lib/install-agent.js";

export const installCommand = new Command("install")
  .description("Install an agent from the registry")
  .argument("<id>", "Agent ID (@scope/name[@version])")
  .action(async (id: string) => {
    const raw = id.replace(/^@/, "");
    const atIdx = raw.indexOf("@", raw.indexOf("/") + 1);
    const idPart = atIdx > 0 ? raw.slice(0, atIdx) : raw;
    const versionPart = atIdx > 0 ? raw.slice(atIdx + 1) : undefined;

    const [scope, name] = idPart.split("/");
    if (!scope || !name) {
      console.error("Invalid ID. Use @scope/name or @scope/name@version.");
      process.exit(1);
    }

    const client = await getClient();

    try {
      // Resolve version
      let version: string;
      if (versionPart) {
        version = versionPart;
      } else {
        const agent = await client.getAgent(scope, name);
        if (!agent.latestVersion) {
          console.error("No published versions found.");
          process.exit(1);
        }
        version = agent.latestVersion.version;
      }

      await installAgent(client, scope, name, version);
    } catch (err: any) {
      const code = err.code ? `[${err.code}] ` : "";
      console.error(`Install failed: ${code}${err.message}`);
      if (err.details) {
        console.error(`  Details: ${JSON.stringify(err.details)}`);
      }
      process.exit(1);
    }
  });
