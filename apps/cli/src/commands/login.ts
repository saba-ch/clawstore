import { Command } from "commander";
import * as p from "@clack/prompts";
import { writeToken, getApiUrl } from "../lib/config.js";

export const loginCommand = new Command("login")
  .description("Authenticate with GitHub OAuth via device flow")
  .action(async () => {
    p.intro("clawstore login");

    const apiUrl = await getApiUrl();
    // Use Better Auth's device authorization flow
    const baseUrl = apiUrl.replace(/\/v1$/, "");

    // Step 1: Request a device code
    const codeRes = await fetch(`${baseUrl}/api/auth/device-authorization/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "clawstore-cli" }),
    });

    if (!codeRes.ok) {
      p.cancel("Failed to start device authorization flow.");
      process.exit(1);
    }

    const codeData = await codeRes.json() as {
      deviceCode: string;
      userCode: string;
      verificationUri: string;
      verificationUriComplete: string;
      expiresIn: number;
      interval: number;
    };

    p.note(
      `Code: ${codeData.userCode}\nURL: ${codeData.verificationUriComplete}`,
      "Open this URL in your browser"
    );

    // Try to open the browser
    try {
      const open = (await import("open")).default;
      await open(codeData.verificationUriComplete);
      console.log("  Browser opened automatically.\n");
    } catch {
      console.log("  Open the URL above manually.\n");
    }

    // Step 2: Poll for token
    const spinner = p.spinner();
    spinner.start("Waiting for authorization...");

    const interval = (codeData.interval || 5) * 1000;
    const deadline = Date.now() + codeData.expiresIn * 1000;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, interval));

      const tokenRes = await fetch(`${baseUrl}/api/auth/device-authorization/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceCode: codeData.deviceCode }),
      });

      if (tokenRes.ok) {
        const tokenData = await tokenRes.json() as { token: string };
        if (tokenData.token) {
          await writeToken(tokenData.token);
          spinner.stop("Logged in successfully.");
          p.outro("Token saved to ~/.clawstore/auth.json");
          return;
        }
      }

      const body = await tokenRes.json().catch(() => null) as { error?: string } | null;
      if (body?.error === "expired_token") {
        spinner.stop("Device code expired.");
        p.cancel("Try again with `clawstore login`.");
        process.exit(1);
      }
      // authorization_pending — keep polling
    }

    spinner.stop("Timed out.");
    p.cancel("Authorization timed out. Try again.");
    process.exit(1);
  });
