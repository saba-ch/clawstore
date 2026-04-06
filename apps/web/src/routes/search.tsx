import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { api } from "../lib/api"
import { formatCount } from "../lib/utils"
import { Search, Download, Star } from "lucide-react"
import type { Agent } from "@clawstore/sdk"

type SearchParams = { q?: string }

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: search.q as string | undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    if (!deps.q) return { agents: [], query: "" }
    try {
      const result = await api.searchAgents({ q: deps.q, limit: 40 })
      return { agents: result.items, query: deps.q }
    } catch {
      return { agents: [], query: deps.q ?? "" }
    }
  },
  component: SearchPage,
  errorComponent: ({ error }) => (
    <div className="max-w-3xl mx-auto px-6 py-20 text-center">
      <h1 className="text-xl font-semibold text-white mb-2">
        Something went wrong
      </h1>
      <p className="text-gray-400">{error.message}</p>
    </div>
  ),
})

function SearchPage() {
  const { agents, query } = Route.useLoaderData()
  const navigate = useNavigate()
  const [input, setInput] = useState(query)

  useEffect(() => {
    if (!input.trim()) return
    const timer = setTimeout(() => {
      navigate({ to: "/search", search: { q: input.trim() } })
    }, 300)
    return () => clearTimeout(timer)
  }, [input])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Search input */}
      <form onSubmit={(e) => e.preventDefault()} className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search agents..."
            autoFocus
            className="w-full pl-11 pr-4 py-3.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-neutral-700 focus:ring-1 focus:ring-neutral-700 transition-all text-sm"
          />
        </div>
      </form>

      {/* Results header */}
      {query && (
        <p className="text-sm text-gray-500 mb-5">
          {agents.length} result{agents.length !== 1 ? "s" : ""} for{" "}
          <span className="text-gray-300">"{query}"</span>
        </p>
      )}

      {/* No query state */}
      {!query && (
        <div className="text-center py-16">
          <Search className="w-10 h-10 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">
            Search by name, description, or tags
          </p>
        </div>
      )}

      {/* No results */}
      {query && agents.length === 0 && (
        <div className="text-center py-16 bg-neutral-900/30 border border-neutral-800/40 rounded-xl">
          <p className="text-gray-500 mb-2">No agents match your search.</p>
          <Link
            to="/browse"
            className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
          >
            Browse all agents
          </Link>
        </div>
      )}

      {/* Results */}
      <div className="space-y-3">
        {agents.map((a: Agent) => (
          <Link
            key={a.id}
            to="/agents/$scope/$name"
            params={{ scope: a.scope, name: a.name }}
            className="group block bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-5 hover:border-neutral-700 hover:bg-neutral-800/40 transition-all"
          >
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <div className="min-w-0">
                <span className="font-medium text-white group-hover:text-amber-400 transition-colors">
                  {a.displayName}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  @{a.scope}/{a.name}
                </span>
              </div>
              {a.category && (
                <span className="px-2 py-0.5 bg-neutral-800 border border-neutral-700/50 rounded-md text-[11px] text-gray-500 shrink-0">
                  {a.category}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mb-3">{a.tagline}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Download className="w-3 h-3" />
                {formatCount(a.downloadCount)}
              </span>
              {a.avgRating != null && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400/70 fill-amber-400/70" />
                  {a.avgRating.toFixed(1)}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
