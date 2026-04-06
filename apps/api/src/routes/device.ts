import { Hono } from "hono";
import { html } from "hono/html";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// GET /device?user_code=XXXX — device authorization approval page
app.get("/device", (c) => {
  const userCode = c.req.query("user_code") ?? "";
  const baseUrl = new URL(c.req.url).origin;

  return c.html(html`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Authorize Device — Clawstore</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; background: #0a0f1c; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 2rem; max-width: 400px; width: 100%; text-align: center; }
          h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
          p { color: #94a3b8; font-size: 0.875rem; margin-bottom: 1.5rem; }
          .code { font-family: monospace; font-size: 2rem; font-weight: bold; letter-spacing: 0.15em; color: #22d3ee; background: #0f172a; padding: 0.75rem 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; display: inline-block; }
          .btn { display: inline-block; padding: 0.625rem 1.5rem; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; border: none; transition: background 0.15s; }
          .btn-primary { background: #06b6d4; color: white; margin-right: 0.5rem; }
          .btn-primary:hover { background: #0891b2; }
          .btn-secondary { background: #334155; color: #94a3b8; }
          .btn-secondary:hover { background: #475569; }
          .login-link { color: #06b6d4; text-decoration: none; }
          .login-link:hover { text-decoration: underline; }
          #result { margin-top: 1rem; font-size: 0.875rem; }
          .success { color: #4ade80; }
          .error { color: #f87171; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Authorize CLI</h1>
          <p>The Clawstore CLI is requesting access to your account.</p>
          <div class="code">${userCode || "——"}</div>
          <p>Confirm this code matches what your terminal shows.</p>
          <div id="actions">
            <button class="btn btn-primary" onclick="approve()">Approve</button>
            <button class="btn btn-secondary" onclick="deny()">Deny</button>
          </div>
          <div id="result"></div>
          <div id="login-prompt" style="display: none; margin-top: 1rem;">
            <p>You need to sign in first.</p>
            <a href="${baseUrl}/api/auth/sign-in/social?provider=github&callbackURL=${encodeURIComponent(baseUrl + "/device?user_code=" + userCode)}" class="login-link">Sign in with GitHub</a>
          </div>
        </div>
        <script>
          const userCode = "${userCode}";
          const baseUrl = "${baseUrl}";

          async function approve() {
            const res = await fetch(baseUrl + "/api/auth/device/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ user_code: userCode }),
            });
            const el = document.getElementById("result");
            if (res.ok) {
              el.className = "success";
              el.textContent = "Approved! You can close this tab.";
              document.getElementById("actions").style.display = "none";
            } else if (res.status === 401) {
              document.getElementById("actions").style.display = "none";
              document.getElementById("login-prompt").style.display = "block";
            } else {
              const body = await res.json().catch(() => ({}));
              el.className = "error";
              el.textContent = body.message || "Something went wrong.";
            }
          }

          async function deny() {
            await fetch(baseUrl + "/api/auth/device/deny", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ user_code: userCode }),
            });
            const el = document.getElementById("result");
            el.className = "error";
            el.textContent = "Denied. You can close this tab.";
            document.getElementById("actions").style.display = "none";
          }
        </script>
      </body>
    </html>`);
});

export default app;
