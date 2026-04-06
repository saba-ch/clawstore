import { Link } from "@tanstack/react-router"
import { Github, Heart } from "lucide-react"
import { GitHubStars } from "./GitHubStars"

export function Footer() {
  return (
    <footer className="border-t border-neutral-800/80 bg-neutral-950 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Explore</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/browse"
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Browse agents
                </Link>
              </li>
              <li>
                <Link
                  to="/search"
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Search
                </Link>
              </li>
              <li>
                <Link
                  to="/browse"
                  search={{ sort: "downloads" }}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Popular
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">
              Developers
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://docs.useclawstore.com"
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a
                  href="https://docs.useclawstore.com/authors/publishing"
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Publish an agent
                </a>
              </li>
              <li>
                <a
                  href="https://docs.useclawstore.com/operators/installing"
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Install guide
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">
              Community
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://github.com/saba-ch/clawstore"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-300 transition-colors inline-flex items-center gap-1.5"
                >
                  <Github className="w-3.5 h-3.5" />
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/saba-ch/clawstore/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Report an issue
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">
              Open Source
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              The open app store for the OpenClaw agent ecosystem.
            </p>
            <GitHubStars />
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-neutral-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} ClawStore. Open source under MIT.
          </p>
          <p className="text-xs text-gray-600 flex items-center gap-1">
            Built with{" "}
            <Heart className="w-3 h-3 text-red-400/60 fill-red-400/60" /> for
            the OpenClaw community
          </p>
        </div>
      </div>
    </footer>
  )
}
