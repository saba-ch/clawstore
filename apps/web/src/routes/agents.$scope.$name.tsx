import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { api } from "../lib/api"
import { formatCount } from "../lib/utils"
import {
  Download,
  Star,
  Tag,
  ExternalLink,
  Copy,
  Check,
  Github,
  Globe,
  Scale,
  Package,
} from "lucide-react"

export const Route = createFileRoute("/agents/$scope/$name")({
  loader: async ({ params }) => {
    const agent = await api.getAgent(params.scope, params.name)
    return { agent }
  },
  component: AgentDetailPage,
  errorComponent: ({ error }) => (
    <div className="max-w-3xl mx-auto px-6 py-20 text-center">
      <h1 className="text-xl font-semibold text-white mb-2">
        Something went wrong
      </h1>
      <p className="text-gray-400">{error.message}</p>
    </div>
  ),
})

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 text-gray-500 hover:text-white rounded-md hover:bg-neutral-700/50 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  )
}

function isGitHubUrl(url: string): boolean {
  return url.includes("github.com")
}

function AgentDetailPage() {
  const { agent } = Route.useLoaderData()
  const installCmd = `clawstore install @${agent.scope}/${agent.name}`

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/20 to-blue-500/20 border border-neutral-800 flex items-center justify-center shrink-0">
            <Package className="w-7 h-7 text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
              {agent.displayName}
            </h1>
            <div className="text-sm text-gray-500">
              @{agent.scope}/{agent.name}
            </div>
          </div>
        </div>
        <p className="text-base text-gray-300 leading-relaxed">
          {agent.tagline}
        </p>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-8 text-sm">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Download className="w-4 h-4" />
          <span className="font-medium text-white">
            {formatCount(agent.downloadCount)}
          </span>{" "}
          downloads
        </div>
        {agent.avgRating != null && (
          <div className="flex items-center gap-1.5 text-gray-400">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="font-medium text-white">
              {agent.avgRating.toFixed(1)}
            </span>
            <span className="text-gray-500">
              ({agent.reviewCount} review{agent.reviewCount !== 1 ? "s" : ""})
            </span>
          </div>
        )}
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-gray-400">
          <Scale className="w-3 h-3" />
          {agent.license}
        </span>
        <span className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-gray-400">
          {agent.category}
        </span>
      </div>

      {/* Install command */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 overflow-x-auto">
            <span className="text-gray-600 text-sm select-none shrink-0">
              $
            </span>
            <code className="text-amber-400 text-sm whitespace-nowrap">
              {installCmd}
            </code>
          </div>
          <CopyButton text={installCmd} />
        </div>
        <div className="text-xs text-gray-600 mt-2">
          First time?{" "}
          <a
            href="https://docs.useclawstore.com/operators/installing"
            className="text-amber-400/70 hover:text-amber-400 transition-colors"
          >
            Read the install guide
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Description */}
          <section>
            <h2 className="text-base font-semibold text-white mb-3">About</h2>
            <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap bg-neutral-900/30 border border-neutral-800/40 rounded-xl p-5">
              {agent.description || "No description provided."}
            </div>
          </section>

          {/* Latest version */}
          {agent.latestVersion && (
            <section>
              <h2 className="text-base font-semibold text-white mb-3">
                Latest version
              </h2>
              <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-5">
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="text-white font-mono text-sm">
                    {agent.latestVersion.version}
                  </span>
                  <span className="px-2 py-0.5 bg-neutral-800 border border-neutral-700/50 rounded-md text-[11px] text-gray-400">
                    {agent.latestVersion.channel}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {(agent.latestVersion.tarballSizeBytes / 1024).toFixed(1)} KB
                  tarball
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Author */}
          {agent.owner && (
            <section className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-5">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Author
              </h3>
              <Link
                to="/users/$username"
                params={{ username: agent.owner.githubLogin }}
                className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors"
              >
                {agent.owner.avatarUrl ? (
                  <img
                    src={agent.owner.avatarUrl}
                    alt=""
                    className="w-8 h-8 rounded-full ring-1 ring-neutral-700"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-neutral-800 ring-1 ring-neutral-700 flex items-center justify-center text-xs font-medium text-gray-500">
                    {(
                      agent.owner.displayName ??
                      agent.owner.githubLogin ??
                      "?"
                    )[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium">
                    {agent.owner.displayName ?? agent.owner.githubLogin}
                  </div>
                  <div className="text-xs text-gray-500">
                    @{agent.owner.githubLogin}
                  </div>
                </div>
              </Link>
            </section>
          )}

          {/* Tags */}
          {agent.tags.length > 0 && (
            <section className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-5">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {agent.tags.map((tag: string) => (
                  <Link
                    key={tag}
                    to="/browse"
                    search={{ tag }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-800 border border-neutral-700/50 rounded-lg text-xs text-gray-400 hover:border-neutral-600 hover:text-gray-300 transition-colors"
                  >
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Links */}
          {(agent.homepage || agent.repository) && (
            <section className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-5">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Links
              </h3>
              <div className="space-y-2 text-sm">
                {agent.repository && (
                  <a
                    href={agent.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                  >
                    {isGitHubUrl(agent.repository) ? (
                      <Github className="w-4 h-4" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    Repository
                    <ExternalLink className="w-3 h-3 text-gray-600 ml-auto" />
                  </a>
                )}
                {agent.homepage && (
                  <a
                    href={agent.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    Homepage
                    <ExternalLink className="w-3 h-3 text-gray-600 ml-auto" />
                  </a>
                )}
              </div>
            </section>
          )}

          {/* Publish CTA */}
          <section className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-5">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Want to publish?
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Share your AI agents with the community.
            </p>
            <a
              href="https://docs.useclawstore.com/authors/publishing"
              className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              Publishing guide &rarr;
            </a>
          </section>
        </div>
      </div>
    </div>
  )
}
