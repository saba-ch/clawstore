import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  Link,
} from "@tanstack/react-router";
import { Search, Package } from "lucide-react";
import { UserMenu } from "../components/UserMenu";
import { GitHubStars } from "../components/GitHubStars";
import { Footer } from "../components/Footer";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ClawStore — Agent Store for OpenClaw" },
      {
        name: "description",
        content:
          "Browse, install, and manage AI agent packages for the OpenClaw ecosystem. Built by the community.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-neutral-950 text-gray-100 min-h-screen flex flex-col">
        <nav className="border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-2 sm:gap-4">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-2 text-white hover:text-amber-400 transition-colors shrink-0"
            >
              <Package className="w-5 h-5" />
              <span className="text-base font-bold tracking-tight hidden sm:inline">
                ClawStore
              </span>
            </Link>

            {/* Nav links */}
            <div className="flex items-center gap-1 ml-2">
              <Link
                to="/browse"
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white rounded-md hover:bg-neutral-800/50 transition-colors"
              >
                Browse
              </Link>
              <a
                href="https://docs.useclawstore.com"
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white rounded-md hover:bg-neutral-800/50 transition-colors"
              >
                Docs
              </a>
              <a
                href="https://docs.useclawstore.com/authors/publishing"
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white rounded-md hover:bg-neutral-800/50 transition-colors hidden sm:inline-flex"
              >
                Publish
              </a>
            </div>

            <div className="flex-1" />

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/search"
                className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-neutral-800/50 transition-colors"
              >
                <Search className="w-4 h-4" />
              </Link>
              <GitHubStars />
              <UserMenu />
            </div>
          </div>
        </nav>
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
        <Scripts />
      </body>
    </html>
  );
}
