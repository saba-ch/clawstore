/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "clawstore",
      removal: input?.stage === "production" ? "retain" : "remove",
      providers: {
        cloudflare: true,
      },
      home: "cloudflare",
    };
  },
  async run() {
    // ── Storage ──────────────────────────────────────────────
    const db = new sst.cloudflare.D1("Database");
    const bucket = new sst.cloudflare.Bucket("Tarballs");
    const kv = new sst.cloudflare.Kv("RateLimit");

    // ── API Worker ───────────────────────────────────────────
    const api = new sst.cloudflare.Worker("Api", {
      handler: "apps/api/src/index.ts",
      url: true,
      link: [db, bucket, kv],
    });

    // ── Web Worker ───────────────────────────────────────────
    // Uncomment when web app build is wired up:
    // const web = new sst.cloudflare.Worker("Web", {
    //   handler: "apps/web/.output/server/index.mjs",
    //   url: true,
    //   link: [api],
    // });

    return {
      apiUrl: api.url,
    };
  },
});
