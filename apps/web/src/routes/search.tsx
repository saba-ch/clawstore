import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { Agent } from '@clawstore/sdk'

type SearchParams = { q?: string }

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: search.q as string | undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    if (!deps.q) return { agents: [], query: '' }
    const result = await api.searchAgents({ q: deps.q, limit: 40 })
    return { agents: result.items, query: deps.q }
  },
  component: SearchPage,
  errorComponent: ({ error }) => (
    <div className="max-w-3xl mx-auto px-6 py-20 text-center">
      <h1 className="text-xl font-semibold text-white mb-2">Something went wrong</h1>
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
      navigate({ to: '/search', search: { q: input.trim() } })
    }, 300)
    return () => clearTimeout(timer)
  }, [input])

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <form onSubmit={(e) => e.preventDefault()} className="mb-8">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search agents..."
          autoFocus
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
        />
      </form>

      {query && (
        <p className="text-sm text-gray-500 mb-4">
          {agents.length} result{agents.length !== 1 ? 's' : ''} for "{query}"
        </p>
      )}

      <div className="space-y-3">
        {agents.map((a: Agent) => (
          <Link
            key={a.id}
            to="/agents/$scope/$name"
            params={{ scope: a.scope, name: a.name }}
            className="block bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-cyan-500/50 transition-colors"
          >
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-medium text-white">{a.displayName}</span>
              <span className="text-xs text-gray-500">@{a.scope}/{a.name}</span>
            </div>
            <p className="text-sm text-gray-400">{a.tagline}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
