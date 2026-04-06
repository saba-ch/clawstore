import { Command } from "commander";
import { getClient } from "../lib/client.js";

export const infoCommand = new Command("info")
  .description("Show agent detail")
  .argument("<id>", "Agent ID (@scope/name)")
  .action(async (id: string) => {
    const match = id.replace(/^@/, "").split("/");
    if (match.length !== 2) {
      console.error("Invalid ID. Use @scope/name format.");
      process.exit(1);
    }
    const [scope, name] = match;
    const client = await getClient();

    try {
      const agent = await client.getAgent(scope, name);

      console.log(`\n  ${agent.displayName} (@${agent.scope}/${agent.name})`);
      console.log(`  ${agent.tagline}\n`);
      console.log(`  ${agent.description}\n`);
      console.log(`  Category:   ${agent.category}`);
      console.log(`  License:    ${agent.license}`);
      console.log(`  Downloads:  ${agent.downloadCount}`);
      console.log(`  Rating:     ${agent.avgRating ? `${agent.avgRating.toFixed(1)}★ (${agent.reviewCount} reviews)` : "no ratings"}`);
      console.log(`  Tags:       ${agent.tags.join(", ") || "none"}`);

      if (agent.latestVersion) {
        console.log(`\n  Latest version: ${agent.latestVersion.version} (${agent.latestVersion.channel})`);
        console.log(`  Published:      ${agent.latestVersion.uploadedAt}`);
        console.log(`  Size:           ${(agent.latestVersion.tarballSizeBytes / 1024).toFixed(1)} KB`);
      }

      if (agent.owner) {
        console.log(`\n  Author: ${agent.owner.displayName ?? agent.owner.githubLogin}`);
      }

      if (agent.homepage) console.log(`  Homepage: ${agent.homepage}`);
      if (agent.repository) console.log(`  Repo:     ${agent.repository}`);

      console.log();
    } catch (err: any) {
      console.error(err.message);
      process.exit(1);
    }
  });
