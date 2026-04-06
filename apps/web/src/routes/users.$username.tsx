import { createFileRoute, Link } from '@tanstack/react-router'
import { api } from '../lib/api'

export const Route = createFileRoute('/users/$username')({
  loader: async ({ params }) => {
    const user = await api.getUser(params.username)
    return { user }
  },
  component: UserProfilePage,
})

function UserProfilePage() {
  const { user } = Route.useLoaderData()

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-4 mb-8">
        {user.avatarUrl && (
          <img src={user.avatarUrl} alt="" className="w-16 h-16 rounded-full" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">
            {user.displayName ?? user.githubLogin}
          </h1>
          <div className="text-sm text-gray-500">@{user.githubLogin}</div>
          {user.bio && <p className="text-gray-400 mt-1">{user.bio}</p>}
        </div>
      </div>

      <h2 className="text-lg font-semibold text-white mb-4">Published agents</h2>

      {user.agents.length === 0 ? (
        <p className="text-gray-500">No agents published yet.</p>
      ) : (
        <div className="space-y-3">
          {user.agents.map((a) => (
            <Link
              key={`${a.scope}/${a.name}`}
              to="/agents/$scope/$name"
              params={{ scope: a.scope, name: a.name }}
              className="block bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-cyan-500/50 transition-colors"
            >
              <div className="font-medium text-white">@{a.scope}/{a.name}</div>
              <p className="text-sm text-gray-400 mt-1">{a.tagline}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
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
