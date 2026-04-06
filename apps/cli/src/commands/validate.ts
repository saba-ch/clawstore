import { Command } from "commander";
import { resolve } from "node:path";
import { validate } from "@clawstore/validator";

export const validateCommand = new Command("validate")
  .description("Validate an agent package directory")
  .argument("[path]", "Package directory path", ".")
  .action(async (path: string) => {
    const dir = resolve(path);
    console.log(`Validating ${dir}...\n`);

    const result = await validate(dir);

    for (const e of result.errors) {
      console.error(`  ERROR  ${e.code}: ${e.message}${e.path ? ` (${e.path})` : ""}`);
    }
    for (const w of result.warnings) {
      console.warn(`  WARN   ${w.code}: ${w.message}${w.path ? ` (${w.path})` : ""}`);
    }

    if (result.valid) {
      console.log("\nValidation passed.");
    } else {
      console.error(`\nValidation failed with ${result.errors.length} error(s).`);
      process.exit(1);
    }
  });
