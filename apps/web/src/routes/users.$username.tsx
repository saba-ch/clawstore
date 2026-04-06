import { createFileRoute, Link } from "@tanstack/react-router"
import { api } from "../lib/api"
import { formatCount } from "../lib/utils"
import {
  Download,
  Star,
  MapPin,
  Globe,
  Calendar,
  Package,
} from "lucide-react"

export const Route = createFileRoute("/users/$username")({
  loader: async ({ params }) => {
    const user = await api.getUser(params.username)
    return { user }
  },
  component: UserProfilePage,
  errorComponent: ({ error }) => (
    <div className="max-w-3xl mx-auto px-6 py-20 text-center">
      <h1 className="text-xl font-semibold text-white mb-2">
        Something went wrong
      </h1>
      <p className="text-gray-400">{error.message}</p>
    </div>
  ),
})

function UserProfilePage() {
  const { user } = Route.useLoaderData()
  const totalDownloads = user.agents.reduce(
    (sum, a) => sum + a.downloadCount,
    0
  )

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Profile header */}
      <div className="flex items-start gap-5 mb-8">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="w-20 h-20 rounded-full ring-2 ring-neutral-700"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-neutral-800 ring-2 ring-neutral-700 flex items-center justify-center text-2xl font-bold text-gray-500">
            {(user.displayName ?? user.githubLogin ?? "?")[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white">
            {user.displayName ?? user.githubLogin}
          </h1>
          <div className="text-sm text-gray-500 mt-0.5">
            @{user.githubLogin}
          </div>
          {user.bio && (
            <p className="text-gray-300 mt-2 text-sm leading-relaxed">
              {user.bio}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-gray-500">
            {user.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {user.location}
              </span>
            )}
            {user.website && (
              <a
                href={user.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-amber-400 transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                {user.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {user.createdAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Joined{" "}
                {new Date(user.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-4 text-center">
          <div className="text-xl font-bold text-white">
            {user.agents.length}
          </div>
          <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
            <Package className="w-3 h-3" />
            Agents
          </div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-4 text-center">
          <div className="text-xl font-bold text-white">
            {formatCount(totalDownloads)}
          </div>
          <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
            <Download className="w-3 h-3" />
            Downloads
          </div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-4 text-center">
          <div className="text-xl font-bold text-white">
            {user.agents.filter((a) => a.avgRating != null).length > 0
              ? (
                  user.agents
                    .filter((a) => a.avgRating != null)
                    .reduce((sum, a) => sum + (a.avgRating ?? 0), 0) /
                  user.agents.filter((a) => a.avgRating != null).length
                ).toFixed(1)
              : "\u2014"}
          </div>
          <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
            <Star className="w-3 h-3" />
            Avg rating
          </div>
        </div>
      </div>

      {/* Published agents */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-white">
          Published agents
        </h2>
      </div>

      {user.agents.length === 0 ? (
        <div className="text-center py-12 bg-neutral-900/30 border border-neutral-800/40 rounded-xl">
          <Package className="w-8 h-8 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No agents published yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {user.agents.map((a) => (
            <Link
              key={`${a.scope}/${a.name}`}
              to="/agents/$scope/$name"
              params={{ scope: a.scope, name: a.name }}
              className="group block bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-5 hover:border-neutral-700 hover:bg-neutral-800/40 transition-all"
            >
              <div className="font-medium text-white group-hover:text-amber-400 transition-colors">
                @{a.scope}/{a.name}
              </div>
              <p className="text-sm text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
                {a.tagline}
              </p>
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
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
      )}
    </div>
  )
}
