import { Command } from "commander";
import * as p from "@clack/prompts";
import { getAuthenticatedClient } from "../lib/client.js";

export const whoamiCommand = new Command("whoami")
  .description("Display the currently authenticated user")
  .action(async () => {
    const client = await getAuthenticatedClient();

    try {
      const me = await client.getMe();
      p.intro("clawstore whoami");
      p.log.info(`Name:  ${me.name}`);
      p.log.info(`Scope: @${me.scope ?? "—"}`);
      p.log.info(`Email: ${me.email}`);
      p.log.info(`Agents: ${me.ownedAgentCount}`);
      p.outro("");
    } catch (e: any) {
      console.error(`Failed to fetch user info: ${e.message}`);
      process.exit(1);
    }
  });
