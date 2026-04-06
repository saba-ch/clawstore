import { join } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as tar from "tar";
import type { ClawstoreClient } from "@clawstore/sdk";
import { getConfigDir } from "./config.js";

const execFileAsync = promisify(execFile);

/**
 * Downloads, verifies, extracts, and registers an agent.
 * Shared by `install` and `update` commands.
 *
 * @param skipRegister - Skip openclaw registration (e.g., during updates when the agent already exists)
 */
export async function installAgent(
  client: ClawstoreClient,
  scope: string,
  name: string,
  version: string,
  opts?: { skipRegister?: boolean }
): Promise<void> {
  console.log(`Installing @${scope}/${name}@${version}...`);

  // Download tarball
  const tarballUrl = client.getTarballUrl(scope, name, version);
  const res = await fetch(tarballUrl);
  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }

  // Read tarball into buffer for integrity check
  const tarballBuffer = Buffer.from(await res.arrayBuffer());

  // Verify SHA-256 integrity
  const versionDetail = await client.getVersion(scope, name, version);
  const expectedSha = versionDetail.tarballSha256;
  const actualSha = createHash("sha256").update(tarballBuffer).digest("hex");
  if (actualSha !== expectedSha) {
    throw new Error(
      `Integrity check failed!\n  Expected SHA-256: ${expectedSha}\n  Actual SHA-256:   ${actualSha}`
    );
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

  if (opts?.skipRegister) return;

  // Auto-register with openclaw
  try {
    let model: string | undefined;
    try {
      const agentJson = JSON.parse(
        await readFile(join(workspaceDir, "agent.json"), "utf-8")
      );
      model = agentJson.agent?.defaults?.model;
    } catch {
      // No agent.json or no model — skip
    }

    const args = [
      "agents",
      "add",
      name,
      "--workspace",
      workspaceDir,
      "--non-interactive",
    ];
    if (model) args.push("--model", model);

    await execFileAsync("openclaw", args);
    console.log(`Registered agent "${name}" with openclaw.`);
  } catch {
    console.log(
      `Tip: run \`openclaw agents add ${name} --workspace ${workspaceDir}\` to register manually.`
    );
  }
}
