import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { api } from "../lib/api"
import { formatCount } from "../lib/utils"
import {
  Download,
  Star,
  Search,
  LayoutGrid,
  LayoutList,
  ChevronDown,
} from "lucide-react"
import { CategoryIcon } from "../components/CategoryIcon"
import type { Agent, Category } from "@clawstore/sdk"

type BrowseSearch = {
  category?: string
  tag?: string
  sort?: string
  q?: string
}

export const Route = createFileRoute("/browse")({
  validateSearch: (search: Record<string, unknown>): BrowseSearch => ({
    category: search.category as string | undefined,
    tag: search.tag as string | undefined,
    sort: search.sort as string | undefined,
    q: search.q as string | undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    try {
      const [agents, categories] = await Promise.all([
        api.searchAgents({
          q: deps.q,
          category: deps.category,
          tag: deps.tag,
          sort: (deps.sort as any) ?? "recent",
          limit: 40,
        }),
        api.getCategories(),
      ])
      return { agents: agents.items, categories, filters: deps }
    } catch {
      return { agents: [], categories: [], filters: deps }
    }
  },
  component: BrowsePage,
  errorComponent: ({ error }) => (
    <div className="max-w-3xl mx-auto px-6 py-20 text-center">
      <h1 className="text-xl font-semibold text-white mb-2">
        Something went wrong
      </h1>
      <p className="text-gray-400">{error.message}</p>
    </div>
  ),
})

const sortOptions = [
  { key: "recent", label: "Recent" },
  { key: "downloads", label: "Downloads" },
  { key: "rating", label: "Rating" },
  { key: "name", label: "Name" },
] as const

function BrowsePage() {
  const { agents, categories, filters } = Route.useLoaderData()
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState(filters.q ?? "")
  const [view, setView] = useState<"list" | "grid">("list")
  const [sortOpen, setSortOpen] = useState(false)

  const activeSort =
    sortOptions.find((s) => s.key === filters.sort) ?? sortOptions[0]

  useEffect(() => {
    if (searchInput === (filters.q ?? "")) return
    const timer = setTimeout(() => {
      navigate({
        to: "/browse",
        search: { ...filters, q: searchInput.trim() || undefined },
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          Agents{" "}
          <span className="text-gray-500 font-normal text-lg">
            ({agents.length})
          </span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Browse the agent registry.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name, slug, or description..."
          className="w-full pl-11 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-neutral-700 focus:ring-1 focus:ring-neutral-700 transition-all"
        />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category pills */}
          <Link
            to="/browse"
            search={{ ...filters, category: undefined }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              !filters.category
                ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                : "border-neutral-800 text-gray-400 hover:border-neutral-700 hover:text-gray-300"
            }`}
          >
            All
          </Link>
          {categories.map((cat: Category) => (
            <Link
              key={cat.id}
              to="/browse"
              search={{ ...filters, category: cat.id }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filters.category === cat.id
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                  : "border-neutral-800 text-gray-400 hover:border-neutral-700 hover:text-gray-300"
              }`}
            >
              <CategoryIcon name={cat.icon} className="w-3 h-3" />
              {cat.name}
            </Link>
          ))}

          {filters.tag && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/15 border border-violet-500/30 text-violet-300">
              tag: {filters.tag}
              <Link
                to="/browse"
                search={{ ...filters, tag: undefined }}
                className="ml-1.5 hover:text-white"
              >
                &times;
              </Link>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-gray-300 hover:border-neutral-700 transition-colors"
            >
              {activeSort.label}
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>
            {sortOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setSortOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-36 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl z-20 py-1">
                  {sortOptions.map((s) => (
                    <Link
                      key={s.key}
                      to="/browse"
                      search={{ ...filters, sort: s.key }}
                      onClick={() => setSortOpen(false)}
                      className={`block px-3 py-2 text-xs transition-colors ${
                        activeSort.key === s.key
                          ? "text-amber-400 bg-neutral-800/50"
                          : "text-gray-400 hover:text-white hover:bg-neutral-800/50"
                      }`}
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
            <button
              onClick={() => setView("list")}
              className={`p-1.5 rounded-md transition-colors ${
                view === "list"
                  ? "bg-neutral-800 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView("grid")}
              className={`p-1.5 rounded-md transition-colors ${
                view === "grid"
                  ? "bg-neutral-800 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {agents.length === 0 ? (
        <div className="text-center py-20 bg-neutral-900/30 border border-neutral-800/40 rounded-xl">
          <p className="text-gray-500 mb-2">No agents found.</p>
          <Link
            to="/browse"
            search={{}}
            className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
          >
            Clear filters
          </Link>
        </div>
      ) : view === "list" ? (
        /* List / table view */
        <div className="bg-neutral-900/30 border border-neutral-800/60 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_1.5fr_auto_auto] gap-4 px-5 py-3 border-b border-neutral-800/60 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            <span>Agent</span>
            <span>Summary</span>
            <span className="text-right w-24">Author</span>
            <span className="text-right w-32">Stats</span>
          </div>
          {/* Rows */}
          <div className="divide-y divide-neutral-800/40">
            {agents.map((a: Agent) => (
              <Link
                key={a.id}
                to="/agents/$scope/$name"
                params={{ scope: a.scope, name: a.name }}
                className="group grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto_auto] gap-2 sm:gap-4 px-5 py-4 hover:bg-neutral-800/30 transition-colors items-center"
              >
                {/* Name */}
                <div className="min-w-0">
                  <div className="font-medium text-white group-hover:text-amber-400 transition-colors truncate text-sm">
                    {a.displayName}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5 truncate">
                    @{a.scope}/{a.name}
                  </div>
                </div>
                {/* Summary */}
                <div className="text-sm text-gray-400 truncate">
                  {a.tagline}
                </div>
                {/* Author */}
                <div className="hidden sm:flex items-center gap-1.5 w-24 justify-end">
                  <span className="text-xs text-gray-500 truncate">
                    @{a.scope}
                  </span>
                </div>
                {/* Stats */}
                <div className="flex items-center gap-3 sm:w-32 sm:justify-end text-xs text-gray-500">
                  <span className="flex items-center gap-1" title="Downloads">
                    <Download className="w-3 h-3" />
                    {formatCount(a.downloadCount)}
                  </span>
                  {a.avgRating != null && (
                    <span className="flex items-center gap-1" title="Rating">
                      <Star className="w-3 h-3 text-amber-400/70 fill-amber-400/70" />
                      {formatCount(a.reviewCount)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        /* Grid view */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a: Agent) => (
            <Link
              key={a.id}
              to="/agents/$scope/$name"
              params={{ scope: a.scope, name: a.name }}
              className="group block bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-5 hover:border-neutral-700 hover:bg-neutral-800/40 transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="font-medium text-white group-hover:text-amber-400 transition-colors truncate">
                    {a.displayName}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    @{a.scope}/{a.name}
                  </div>
                </div>
                {a.category && (
                  <span className="px-2 py-0.5 bg-neutral-800 border border-neutral-700/50 rounded-md text-[11px] text-gray-500 shrink-0">
                    {a.category}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 line-clamp-2 mb-4 leading-relaxed">
                {a.tagline}
              </p>
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
                {a.reviewCount > 0 && (
                  <span className="text-gray-600">
                    {a.reviewCount} review{a.reviewCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
