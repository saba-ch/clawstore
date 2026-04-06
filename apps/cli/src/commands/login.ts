import { Command } from "commander";
import * as p from "@clack/prompts";
import { writeToken, readToken, getApiUrl } from "../lib/config.js";
import { createClient } from "@clawstore/sdk";

export const loginCommand = new Command("login")
  .description("Authenticate with GitHub OAuth via device flow")
  .option("--force", "Re-authenticate even if already logged in")
  .action(async (opts) => {
    p.intro("clawstore login");

    // Check if already logged in and token is still valid
    if (!opts.force) {
      const existingToken = await readToken();
      if (existingToken) {
        try {
          const baseUrl = await getApiUrl();
          const client = createClient({ baseUrl, token: existingToken });
          const me = await client.getMe();
          p.log.info(`Already logged in as ${me.scope ?? me.name}. Run with --force to re-authenticate.`);
          p.outro("");
          return;
        } catch {
          p.log.warn("Saved token is invalid or expired. Re-authenticating...");
        }
      }
    }

    const apiUrl = await getApiUrl();
    const baseUrl = apiUrl.replace(/\/v1$/, "");

    // Step 1: Request a device code via Better Auth's device authorization plugin
    const codeRes = await fetch(`${baseUrl}/api/auth/device/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: "clawstore-cli" }),
    });

    if (!codeRes.ok) {
      const body = await codeRes.text();
      p.log.error(`Failed to start device authorization (${codeRes.status}): ${body}`);
      p.cancel("Try again or check your API URL.");
      process.exit(1);
    }

    const codeData = (await codeRes.json()) as {
      device_code: string;
      user_code: string;
      verification_uri: string;
      verification_uri_complete: string;
      expires_in: number;
      interval: number;
    };

    p.note(
      `Code: ${codeData.user_code}\nURL: ${codeData.verification_uri_complete}`,
      "Open this URL in your browser"
    );

    // Try to open the browser
    try {
      const open = (await import("open")).default;
      await open(codeData.verification_uri_complete);
      p.log.info("Browser opened automatically.");
    } catch {
      p.log.info("Open the URL above manually.");
    }

    // Step 2: Poll for token
    const spinner = p.spinner();
    spinner.start("Waiting for authorization...");

    const interval = (codeData.interval || 5) * 1000;
    const deadline = Date.now() + (codeData.expires_in || 300) * 1000;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, interval));

      const tokenRes = await fetch(`${baseUrl}/api/auth/device/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: codeData.device_code,
          client_id: "clawstore-cli",
        }),
      });

      if (tokenRes.ok) {
        const tokenData = (await tokenRes.json()) as {
          access_token?: string;
        };
        if (tokenData.access_token) {
          await writeToken(tokenData.access_token);
          spinner.stop("Logged in successfully.");
          p.outro("Token saved to ~/.clawstore/auth.json");
          return;
        }
      }

      const body = (await tokenRes.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (body?.error === "expired_token") {
        spinner.stop("Device code expired.");
        p.cancel("Try again with `clawstore login`.");
        process.exit(1);
      }
      if (body?.error === "access_denied") {
        spinner.stop("Access denied.");
        p.cancel("Authorization was denied.");
        process.exit(1);
      }
      // authorization_pending — keep polling
    }

    spinner.stop("Timed out.");
    p.cancel("Authorization timed out. Try again.");
    process.exit(1);
  });
