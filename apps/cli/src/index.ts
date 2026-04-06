import { Command } from "commander";

const program = new Command();

program
  .name("clawstore")
  .description("CLI for the ClawStore agent package registry")
  .version("0.0.1");

program.parse();
