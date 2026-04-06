import { createFileRoute, Link } from '@tanstack/react-router'
import { api } from '../lib/api'
import type { Agent, Category } from '@clawstore/sdk'

export const Route = createFileRoute('/')({
  loader: async () => {
    try {
      const [agents, categories] = await Promise.all([
        api.searchAgents({ sort: 'recent', limit: 6 }),
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
      <h1 className="text-xl font-semibold text-white mb-2">Something went wrong</h1>
      <p className="text-gray-400">{error.message}</p>
    </div>
  ),
})

function HomePage() {
  const { agents, categories } = Route.useLoaderData()

  return (
    <div>
      {/* Hero */}
      <section className="py-20 px-6 text-center">
        <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tight">
          Discover agents for{' '}
          <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            OpenClaw
          </span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
          Browse, install, and manage AI agent packages. Built by the community, verified by the store.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            to="/browse"
            className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors"
          >
            Browse agents
          </Link>
          <code className="px-6 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-gray-300 text-sm flex items-center">
            clawstore install @scope/agent
          </code>
        </div>
      </section>

      {/* Getting Started banner */}
      <section className="max-w-7xl mx-auto px-6 mb-16">
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">New to Clawstore?</h3>
            <p className="text-gray-400 text-sm">Learn how to install agents or publish your own in minutes.</p>
          </div>
          <a
            href="https://docs.useclawstore.com"
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors text-sm shrink-0"
          >
            Read the docs
          </a>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-6 mb-16">
        <h2 className="text-xl font-semibold text-white mb-4">Categories</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {categories.map((cat: Category) => (
            <Link
              key={cat.id}
              to="/browse"
              search={{ category: cat.id }}
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center hover:border-cyan-500/50 transition-colors"
            >
              <div className="text-sm text-gray-300">{cat.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent agents */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Recent agents</h2>
          <Link to="/browse" className="text-sm text-cyan-400 hover:text-cyan-300">
            View all
          </Link>
        </div>
        {agents.length === 0 ? (
          <p className="text-gray-500">No agents published yet. Be the first!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((a: Agent) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link
      to="/agents/$scope/$name"
      params={{ scope: agent.scope, name: agent.name }}
      className="block bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-cyan-500/50 transition-colors"
    >
      <div className="font-medium text-white mb-1">{agent.displayName}</div>
      <div className="text-xs text-gray-500 mb-2">@{agent.scope}/{agent.name}</div>
      <p className="text-sm text-gray-400 line-clamp-2">{agent.tagline}</p>
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
        <span>{agent.downloadCount} downloads</span>
        {agent.avgRating && <span>{agent.avgRating.toFixed(1)}★</span>}
        <span>{agent.category}</span>
      </div>
    </Link>
  )
}
