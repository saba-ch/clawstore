import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { validateCommand } from "./commands/validate.js";
import { packCommand } from "./commands/pack.js";
import { loginCommand } from "./commands/login.js";
import { publishCommand } from "./commands/publish.js";
import { yankCommand } from "./commands/yank.js";
import { searchCommand } from "./commands/search.js";
import { infoCommand } from "./commands/info.js";
import { installCommand } from "./commands/install.js";
import { listCommand } from "./commands/list.js";
import { updateCommand } from "./commands/update.js";

const program = new Command();

program
  .name("clawstore")
  .description("CLI for the ClawStore agent package registry")
  .version("0.0.1");

// Author commands
program.addCommand(initCommand);
program.addCommand(validateCommand);
program.addCommand(packCommand);
program.addCommand(loginCommand);
program.addCommand(publishCommand);
program.addCommand(yankCommand);

// Operator commands
program.addCommand(searchCommand);
program.addCommand(infoCommand);
program.addCommand(installCommand);
program.addCommand(listCommand);
program.addCommand(updateCommand);

program.parse();
