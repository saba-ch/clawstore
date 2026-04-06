import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  Link,
} from "@tanstack/react-router";
import { Search } from "lucide-react";
import { UserMenu } from "../components/UserMenu";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Clawstore — Agent Store for OpenClaw" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-slate-950 text-gray-100 min-h-screen">
        <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
            <Link
              to="/"
              className="text-lg font-bold tracking-tight text-white hover:text-cyan-400 transition-colors"
            >
              clawstore
            </Link>
            <Link
              to="/browse"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Browse
            </Link>
            <a
              href="https://docs.useclawstore.com"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Docs
            </a>
            <div className="flex-1" />
            <Link
              to="/search"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <Search className="w-4 h-4" />
            </Link>
            <UserMenu />
          </div>
        </nav>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
