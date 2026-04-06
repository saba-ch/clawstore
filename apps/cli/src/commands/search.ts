import { Command } from "commander";
import { getClient } from "../lib/client.js";

export const searchCommand = new Command("search")
  .description("Search agents in the registry")
  .argument("<query>", "Search query")
  .option("-c, --category <category>", "Filter by category")
  .option("-t, --tag <tag>", "Filter by tag")
  .option("-s, --sort <sort>", "Sort: recent, name, downloads, rating", "recent")
  .option("-l, --limit <n>", "Results per page", "20")
  .action(async (query: string, opts) => {
    const client = await getClient();
    const result = await client.searchAgents({
      q: query,
      category: opts.category,
      tag: opts.tag,
      sort: opts.sort,
      limit: Number(opts.limit),
    });

    if (result.items.length === 0) {
      console.log("No agents found.");
      return;
    }

    for (const a of result.items) {
      const rating = a.avgRating ? `${a.avgRating.toFixed(1)}★` : "no ratings";
      console.log(`  @${a.scope}/${a.name} — ${a.tagline}`);
      console.log(`    ${a.downloadCount} downloads · ${rating} · ${a.category}\n`);
    }

    if (result.nextCursor) {
      console.log(`  ... more results available`);
    }
  });
