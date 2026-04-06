import { createFileRoute, Link } from '@tanstack/react-router'
import { api } from '../lib/api'
import type { Agent, Category } from '@clawstore/sdk'

type BrowseSearch = {
  category?: string
  tag?: string
  sort?: string
}

export const Route = createFileRoute('/browse')({
  validateSearch: (search: Record<string, unknown>): BrowseSearch => ({
    category: search.category as string | undefined,
    tag: search.tag as string | undefined,
    sort: search.sort as string | undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    try {
      const [agents, categories] = await Promise.all([
        api.searchAgents({
          category: deps.category,
          tag: deps.tag,
          sort: (deps.sort as any) ?? 'recent',
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
      <h1 className="text-xl font-semibold text-white mb-2">Something went wrong</h1>
      <p className="text-gray-400">{error.message}</p>
    </div>
  ),
})

function BrowsePage() {
  const { agents, categories, filters } = Route.useLoaderData()

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Browse agents</h1>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          to="/browse"
          search={{}}
          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
            !filters.category
              ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
              : 'border-slate-700 text-gray-400 hover:border-gray-500'
          }`}
        >
          All
        </Link>
        {categories.map((cat: Category) => (
          <Link
            key={cat.id}
            to="/browse"
            search={{ category: cat.id }}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              filters.category === cat.id
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                : 'border-slate-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            {cat.name}
          </Link>
        ))}
      </div>

      {/* Sort */}
      <div className="flex gap-4 mb-6 text-sm">
        {(['recent', 'downloads', 'rating', 'name'] as const).map((s) => (
          <Link
            key={s}
            to="/browse"
            search={{ ...filters, sort: s }}
            className={`capitalize ${
              (filters.sort ?? 'recent') === s ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* Agent grid */}
      {agents.length === 0 ? (
        <p className="text-gray-500 py-12 text-center">No agents found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a: Agent) => (
            <Link
              key={a.id}
              to="/agents/$scope/$name"
              params={{ scope: a.scope, name: a.name }}
              className="block bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-cyan-500/50 transition-colors"
            >
              <div className="font-medium text-white mb-1">{a.displayName}</div>
              <div className="text-xs text-gray-500 mb-2">@{a.scope}/{a.name}</div>
              <p className="text-sm text-gray-400 line-clamp-2">{a.tagline}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                <span>{a.downloadCount} downloads</span>
                {a.avgRating && <span>{a.avgRating.toFixed(1)}★</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
