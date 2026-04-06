import { createFileRoute, Link } from '@tanstack/react-router'
import { api } from '../lib/api'
import { Download, Star, Tag, ExternalLink } from 'lucide-react'

export const Route = createFileRoute('/agents/$scope/$name')({
  loader: async ({ params }) => {
    const agent = await api.getAgent(params.scope, params.name)
    return { agent }
  },
  component: AgentDetailPage,
})

function AgentDetailPage() {
  const { agent } = Route.useLoaderData()

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">{agent.displayName}</h1>
        <div className="text-sm text-gray-500 mb-3">
          @{agent.scope}/{agent.name}
        </div>
        <p className="text-lg text-gray-300">{agent.tagline}</p>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-4 mb-8 text-sm text-gray-400">
        <div className="flex items-center gap-1">
          <Download className="w-4 h-4" />
          {agent.downloadCount} downloads
        </div>
        {agent.avgRating && (
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-400" />
            {agent.avgRating.toFixed(1)} ({agent.reviewCount} reviews)
          </div>
        )}
        <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs">
          {agent.category}
        </span>
        <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs">
          {agent.license}
        </span>
      </div>

      {/* Install command */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-8">
        <div className="text-xs text-gray-500 mb-1">Install</div>
        <code className="text-cyan-400 text-sm">
          clawstore install @{agent.scope}/{agent.name}
        </code>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="md:col-span-2">
          {/* Description */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3">About</h2>
            <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">
              {agent.description || 'No description provided.'}
            </div>
          </section>

          {/* Latest version */}
          {agent.latestVersion && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-3">Latest version</h2>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-white font-mono">{agent.latestVersion.version}</span>
                  <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-gray-400">
                    {agent.latestVersion.channel}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {(agent.latestVersion.tarballSizeBytes / 1024).toFixed(1)} KB
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div>
          {/* Author */}
          {agent.owner && (
            <section className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Author</h3>
              <Link
                to="/users/$username"
                params={{ username: agent.owner.githubLogin }}
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
              >
                {agent.owner.avatarUrl && (
                  <img
                    src={agent.owner.avatarUrl}
                    alt=""
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <span>{agent.owner.displayName ?? agent.owner.githubLogin}</span>
              </Link>
            </section>
          )}

          {/* Tags */}
          {agent.tags.length > 0 && (
            <section className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-1">
                {agent.tags.map((tag: string) => (
                  <Link
                    key={tag}
                    to="/browse"
                    search={{ tag }}
                    className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-gray-400 hover:border-cyan-500/50"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Links */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Links</h3>
            <div className="space-y-1 text-sm">
              {agent.homepage && (
                <a
                  href={agent.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-400 hover:text-cyan-400"
                >
                  <ExternalLink className="w-3 h-3" /> Homepage
                </a>
              )}
              {agent.repository && (
                <a
                  href={agent.repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-400 hover:text-cyan-400"
                >
                  <ExternalLink className="w-3 h-3" /> Repository
                </a>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
