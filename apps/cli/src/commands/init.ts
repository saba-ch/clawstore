import { Command } from "commander";
import * as p from "@clack/prompts";
import { writeFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { SCHEMA_VERSION } from "@clawstore/schema";

const CANONICAL_ENTRYPOINTS = [
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "HEARTBEAT.md",
  "BOOT.md",
  "BOOTSTRAP.md",
];

export const initCommand = new Command("init")
  .description("Scaffold an agent.json in the current directory")
  .argument("[path]", "Directory to initialize", ".")
  .action(async (path: string) => {
    const dir = resolve(path);

    p.intro("clawstore init");

    // Detect existing entrypoint files
    let files: string[] = [];
    try {
      files = await readdir(dir);
    } catch {
      p.cancel("Directory does not exist.");
      process.exit(1);
    }

    const detected = CANONICAL_ENTRYPOINTS.filter((f) => files.includes(f));
    if (detected.length > 0) {
      p.note(detected.join(", "), "Detected workspace files");
    }

    const answers = await p.group(
      {
        id: () =>
          p.text({
            message: "Package ID (@scope/name)",
            placeholder: "@yourname/my-agent",
            validate: (v) =>
              /^@[a-z0-9-]+\/[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(v)
                ? undefined
                : "Must be @scope/name (lowercase, kebab-case)",
          }),
        name: () =>
          p.text({
            message: "Display name",
            placeholder: "My Agent",
          }),
        tagline: () =>
          p.text({
            message: "One-line tagline",
            placeholder: "What does this agent do?",
          }),
        category: () =>
          p.select({
            message: "Category",
            options: [
              { value: "productivity", label: "Productivity" },
              { value: "developer-tools", label: "Developer Tools" },
              { value: "health-fitness", label: "Health & Fitness" },
              { value: "education", label: "Education" },
              { value: "finance", label: "Finance" },
              { value: "communication", label: "Communication" },
              { value: "entertainment", label: "Entertainment" },
              { value: "writing", label: "Writing" },
              { value: "research", label: "Research" },
              { value: "data-analysis", label: "Data Analysis" },
              { value: "customer-support", label: "Customer Support" },
              { value: "other", label: "Other" },
            ],
          }),
        license: () =>
          p.text({
            message: "License",
            initialValue: "MIT",
          }),
        model: () =>
          p.text({
            message: "Default model",
            placeholder: "openai/gpt-4o",
          }),
      },
      {
        onCancel: () => {
          p.cancel("Cancelled.");
          process.exit(0);
        },
      }
    );

    // Build entrypoints from detected files
    const entrypoints: Record<string, string> = {};
    for (const file of detected) {
      entrypoints[file] = file;
    }

    // Build the manifest
    const manifest = {
      schemaVersion: SCHEMA_VERSION,
      id: answers.id,
      version: "0.1.0",
      name: answers.name,
      tagline: answers.tagline,
      description: "",
      category: answers.category,
      tags: [],
      author: { name: "" },
      license: answers.license,
      agent: {
        defaults: {
          model: answers.model,
        },
      },
      files: ["**/*.md", "**/*.json", "**/*.yaml", "**/*.yml"],
      openclaw: {
        entrypoints,
        templates: {},
      },
    };

    const outPath = join(dir, "agent.json");
    await writeFile(outPath, JSON.stringify(manifest, null, 2) + "\n");

    p.outro(`Created ${outPath}`);
  });
