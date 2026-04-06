import { Command } from "commander";
import { resolve, join } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as tar from "tar";
import { getClient } from "../lib/client.js";
import { getConfigDir } from "../lib/config.js";

const execFileAsync = promisify(execFile);

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

      console.log(`Installing @${scope}/${name}@${version}...`);

      // Download tarball
      const tarballUrl = client.getTarballUrl(scope, name, version);
      const res = await fetch(tarballUrl);
      if (!res.ok) {
        console.error(`Download failed: HTTP ${res.status}`);
        process.exit(1);
      }

      // Read tarball into buffer for integrity check
      const tarballBuffer = Buffer.from(await res.arrayBuffer());

      // Verify SHA-256 integrity
      const versionDetail = await client.getVersion(scope, name, version);
      const expectedSha = versionDetail.tarballSha256;
      const actualSha = createHash("sha256").update(tarballBuffer).digest("hex");
      if (actualSha !== expectedSha) {
        console.error(`Integrity check failed!`);
        console.error(`  Expected SHA-256: ${expectedSha}`);
        console.error(`  Actual SHA-256:   ${actualSha}`);
        console.error(`Aborting install.`);
        process.exit(1);
      }
      console.log(`SHA-256 verified: ${actualSha}`);

      // Extract to workspace
      const workspaceDir = join(homedir(), ".openclaw", `workspace-${name}`);
      await mkdir(workspaceDir, { recursive: true });

      const body = Readable.from(tarballBuffer);
      await pipeline(body, tar.extract({ cwd: workspaceDir }));

      // Write install record
      const configDir = await getConfigDir();
      const installsDir = join(configDir, "installs");
      await mkdir(installsDir, { recursive: true });

      const record = {
        id: `@${scope}/${name}`,
        version,
        scope,
        name,
        workspacePath: workspaceDir,
        installedAt: new Date().toISOString(),
        source: "registry",
        updatePolicy: "manual",
      };

      await writeFile(
        join(installsDir, `${name}.json`),
        JSON.stringify(record, null, 2)
      );

      console.log(`\nInstalled to ${workspaceDir}`);

      // Auto-register with openclaw
      try {
        // Read model from agent.json
        let model: string | undefined;
        try {
          const agentJson = JSON.parse(await readFile(join(workspaceDir, "agent.json"), "utf-8"));
          model = agentJson.agent?.defaults?.model;
        } catch {
          // No agent.json or no model — skip
        }

        const args = ["agents", "add", name, "--workspace", workspaceDir, "--non-interactive"];
        if (model) args.push("--model", model);

        await execFileAsync("openclaw", args);
        console.log(`Registered agent "${name}" with openclaw.`);
      } catch {
        console.log(`Tip: run \`openclaw agents add ${name} --workspace ${workspaceDir}\` to register manually.`);
      }
    } catch (err: any) {
      const code = err.code ? `[${err.code}] ` : "";
      console.error(`Install failed: ${code}${err.message}`);
      if (err.details) {
        console.error(`  Details: ${JSON.stringify(err.details)}`);
      }
      process.exit(1);
    }
  });
