import { Command } from "commander";
import * as p from "@clack/prompts";
import { writeFile, readdir, mkdir } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { SCHEMA_VERSION } from "@clawstore/schema";
import { getTemplateFiles } from "@clawstore/template";
import { readAuth } from "../lib/config.js";

const CANONICAL_ENTRYPOINTS = [
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "HEARTBEAT.md",
  "BOOT.md",
  "BOOTSTRAP.md",
];

const VALID_CATEGORIES = [
  "productivity",
  "developer-tools",
  "health-fitness",
  "education",
  "finance",
  "communication",
  "entertainment",
  "writing",
  "research",
  "data-analysis",
  "customer-support",
  "other",
] as const;

export const initCommand = new Command("init")
  .description("Scaffold an agent.json in the current directory")
  .argument("[path]", "Directory to initialize", ".")
  .option("--id <id>", "Package ID (@scope/name)")
  .option("--name <name>", "Display name")
  .option("--tagline <tagline>", "One-line tagline")
  .option("--category <category>", `Category (${VALID_CATEGORIES.join(", ")})`)
  .option("--description <description>", "Short description")
  .option("--author <author>", "Author name")
  .option("--license <license>", "License", "MIT")
  .option("--model <model>", "Default LLM model")
  .action(async (path: string, opts) => {
    const dir = resolve(path);

    // Detect existing entrypoint files
    let files: string[] = [];
    try {
      files = await readdir(dir);
    } catch {
      if (opts.id) {
        console.error("Error: Directory does not exist.");
        process.exit(1);
      }
      p.cancel("Directory does not exist.");
      process.exit(1);
    }

    const detected = CANONICAL_ENTRYPOINTS.filter((f) => files.includes(f));

    // Non-interactive mode: all required flags provided
    const hasAllFlags = opts.id && opts.name && opts.tagline && opts.category && opts.model;

    let answers: {
      id: string;
      name: string;
      tagline: string;
      description: string;
      category: string;
      author: string;
      license: string;
      model: string;
    };

    // Read cached scope/author from auth.json (no API call needed)
    const auth = await readAuth();
    const detectedScope = auth?.scope ?? null;
    const detectedAuthor = auth?.name ?? null;

    if (hasAllFlags) {
      // Validate inputs
      if (!/^@[a-z0-9-]+\/[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(opts.id)) {
        console.error("Error: --id must be @scope/name (lowercase, kebab-case)");
        process.exit(1);
      }
      if (!VALID_CATEGORIES.includes(opts.category)) {
        console.error(`Error: --category must be one of: ${VALID_CATEGORIES.join(", ")}`);
        process.exit(1);
      }

      answers = {
        id: opts.id,
        name: opts.name,
        tagline: opts.tagline,
        description: opts.description || opts.tagline,
        category: opts.category,
        author: opts.author || detectedAuthor || "",
        license: opts.license,
        model: opts.model,
      };
    } else {
      // Interactive mode
      p.intro("clawstore init");

      if (detected.length > 0) {
        p.note(detected.join(", "), "Detected workspace files");
      }

      answers = await p.group(
        {
          id: () =>
            p.text({
              message: "Package ID (@scope/name)",
              placeholder: detectedScope ? `@${detectedScope}/my-agent` : "@yourname/my-agent",
              ...(opts.id ? { initialValue: opts.id } : {}),
              validate: (v) =>
                /^@[a-z0-9-]+\/[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(v)
                  ? undefined
                  : "Must be @scope/name (lowercase, kebab-case)",
            }),
          name: () =>
            p.text({
              message: "Display name",
              placeholder: "My Agent",
              ...(opts.name ? { initialValue: opts.name } : {}),
            }),
          tagline: () =>
            p.text({
              message: "One-line tagline",
              placeholder: "What does this agent do?",
              ...(opts.tagline ? { initialValue: opts.tagline } : {}),
            }),
          description: () =>
            p.text({
              message: "Short description",
              placeholder: "A brief description of what this agent does",
              ...(opts.description ? { initialValue: opts.description } : {}),
            }),
          category: () =>
            p.select({
              message: "Category",
              ...(opts.category ? { initialValue: opts.category } : {}),
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
          author: () =>
            p.text({
              message: "Author name",
              placeholder: "Your name",
              ...(opts.author ? { initialValue: opts.author } : detectedAuthor ? { initialValue: detectedAuthor } : {}),
            }),
          license: () =>
            p.text({
              message: "License",
              initialValue: opts.license || "MIT",
            }),
          model: () =>
            p.text({
              message: "Default model",
              placeholder: "openai/gpt-4o",
              ...(opts.model ? { initialValue: opts.model } : {}),
            }),
        },
        {
          onCancel: () => {
            p.cancel("Cancelled.");
            process.exit(0);
          },
        }
      ) as typeof answers;
    }

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
      description: answers.description || answers.tagline,
      category: answers.category,
      tags: [],
      author: { name: answers.author || "" },
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

    // Scaffold template files
    const templateFiles = getTemplateFiles({
      name: answers.name,
      tagline: answers.tagline,
    });

    for (const file of templateFiles) {
      const filePath = join(dir, file.path);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, file.content);
    }

    if (hasAllFlags) {
      console.log(`Created ${outPath}`);
    } else {
      p.outro(`Created ${outPath}`);
    }
  });
