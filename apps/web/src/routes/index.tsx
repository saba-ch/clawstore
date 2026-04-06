import { createFileRoute, Link } from "@tanstack/react-router"
import { api } from "../lib/api"
import { formatCount } from "../lib/utils"
import { Download, Star, ArrowRight } from "lucide-react"
import { CategoryIcon } from "../components/CategoryIcon"
import type { Agent, Category } from "@clawstore/sdk"

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      const [agents, categories] = await Promise.all([
        api.searchAgents({ sort: "recent", limit: 6 }),
        api.getCategories(),
      ])
      return { agents: agents.items, categories }
    } catch {
      return { agents: [], categories: [] }
    }
  },
  component: HomePage,
  errorComponent: ({ error }) => (
    <div className="max-w-3xl mx-auto px-6 py-20 text-center">
      <h1 className="text-xl font-semibold text-white mb-2">
        Something went wrong
      </h1>
      <p className="text-gray-400">{error.message}</p>
    </div>
  ),
})

function HomePage() {
  const { agents, categories } = Route.useLoaderData()

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-neutral-800/40">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-amber-500/8 via-transparent to-transparent pointer-events-none" />
        <img
          src="/favicon.svg"
          alt=""
          aria-hidden="true"
          className="absolute -right-10 -bottom-16 w-72 h-72 opacity-[0.04] pointer-events-none select-none hidden lg:block"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* Left: text */}
            <div>
              <h1 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight leading-[1.1]">
                The agent store for{" "}
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  OpenClaw.
                </span>
              </h1>
              <p className="text-base sm:text-lg text-gray-400 mb-8 leading-relaxed max-w-lg">
                A package registry for OpenClaw agents. Browse, install, and
                publish agents.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/browse"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors text-sm"
                >
                  Browse agents <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="https://docs.useclawstore.com/authors/publishing"
                  className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-gray-200 font-medium rounded-lg transition-colors text-sm"
                >
                  Publish agent
                </a>
              </div>
            </div>

            {/* Right: install card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl shadow-black/20">
              <p className="text-sm text-gray-400 mb-4">
                Install any agent in one shot:
              </p>
              <div className="bg-neutral-950 rounded-lg p-4 font-mono text-sm">
                <span className="text-gray-500 select-none">$ </span>
                <span className="text-amber-400">
                  clawstore install @scope/agent
                </span>
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Versioned
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Rollback-ready
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  Open source
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 mb-14">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">Categories</h2>
            <Link
              to="/browse"
              className="text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {categories.map((cat: Category) => (
              <Link
                key={cat.id}
                to="/browse"
                search={{ category: cat.id }}
                className="group bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-4 hover:border-neutral-700 hover:bg-neutral-800/40 transition-all"
              >
                <div className="flex flex-col items-center gap-2.5">
                  <CategoryIcon
                    name={cat.icon}
                    className="w-6 h-6 text-gray-400 group-hover:text-amber-400 transition-colors"
                  />
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors text-center">
                    {cat.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent agents */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Recent agents</h2>
          <Link
            to="/browse"
            className="text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-1"
          >
            Browse all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {agents.length === 0 ? (
          <div className="text-center py-16 bg-neutral-900/30 border border-neutral-800/40 rounded-xl">
            <p className="text-gray-500 mb-3">No agents published yet.</p>
            <a
              href="https://docs.useclawstore.com/authors/publishing"
              className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              Be the first to publish
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((a: Agent) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </div>
        )}
      </section>

      {/* Publish CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-900/50 border border-neutral-800/60 rounded-xl p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white mb-1">
              Ready to publish your own agent?
            </h3>
            <p className="text-gray-500 text-sm">
              Package and share your AI agents with the community in minutes.
            </p>
          </div>
          <a
            href="https://docs.useclawstore.com/authors/publishing"
            className="px-5 py-2.5 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-lg transition-colors text-sm shrink-0"
          >
            Get started
          </a>
        </div>
      </section>
    </div>
  )
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link
      to="/agents/$scope/$name"
      params={{ scope: agent.scope, name: agent.name }}
      className="group block bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-5 hover:border-neutral-700 hover:bg-neutral-800/40 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="font-medium text-white group-hover:text-amber-400 transition-colors truncate">
            {agent.displayName}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            @{agent.scope}/{agent.name}
          </div>
        </div>
        {agent.category && (
          <span className="px-2 py-0.5 bg-neutral-800 border border-neutral-700/50 rounded-md text-[11px] text-gray-500 shrink-0">
            {agent.category}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-400 line-clamp-2 mb-4 leading-relaxed">
        {agent.tagline}
      </p>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Download className="w-3 h-3" />
          {formatCount(agent.downloadCount)}
        </span>
        {agent.avgRating != null && (
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400/70 fill-amber-400/70" />
            {agent.avgRating.toFixed(1)}
          </span>
        )}
        {agent.reviewCount > 0 && (
          <span className="text-gray-600">
            {agent.reviewCount} review{agent.reviewCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </Link>
  )
}
