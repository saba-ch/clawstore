import { Command } from "commander";
import { resolve, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";
import { getClient } from "../lib/client.js";
import { getConfigDir } from "../lib/config.js";

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

    // Extract to workspace
    const workspaceDir = join(homedir(), ".openclaw", `workspace-${name}`);
    await mkdir(workspaceDir, { recursive: true });

    const body = Readable.fromWeb(res.body as any);
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
    console.log(`Run your agent with: openclaw agents add ${name} --workspace ${workspaceDir}`);
  });
