import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { api } from "../lib/api"
import { authClient } from "../lib/auth-client"
import type { CurrentUser } from "@clawstore/sdk"
import { Package, MapPin, Globe, ExternalLink } from "lucide-react"

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
})

function ProfilePage() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    authClient.getSession().then(async ({ data }) => {
      if (!data?.user) {
        setError("not_signed_in")
        setLoading(false)
        return
      }
      try {
        const me = await api.getMe()
        setUser(me)
      } catch (e: any) {
        setError(e.message ?? "Failed to load profile")
      }
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading profile...</div>
      </div>
    )
  }

  if (error === "not_signed_in") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-4">
            <Package className="w-6 h-6 text-gray-500" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">
            Sign in required
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            Sign in to view your profile and manage your agents.
          </p>
          <button
            onClick={() =>
              authClient.signIn.social({
                provider: "github",
                callbackURL: window.location.href,
              })
            }
            className="w-full px-6 py-2.5 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-lg transition-colors text-sm"
          >
            Sign in with GitHub
          </button>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-white mb-2">
            Something went wrong
          </h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  const profile = user.profile

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-start gap-5 mb-8">
        {user.image ? (
          <img
            src={user.image}
            alt=""
            className="w-20 h-20 rounded-full ring-2 ring-neutral-700"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-neutral-800 ring-2 ring-neutral-700 flex items-center justify-center text-2xl font-bold text-gray-500">
            {(user.name ?? "?")[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white">
            {profile?.displayName ?? user.name}
          </h1>
          {user.scope && (
            <div className="text-sm text-gray-500 mt-0.5">@{user.scope}</div>
          )}
          <p className="text-sm text-gray-400 mt-0.5">{user.email}</p>
          {profile?.bio && (
            <p className="text-gray-300 mt-2 text-sm">{profile.bio}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-gray-500">
            {profile?.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {profile.location}
              </span>
            )}
            {profile?.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-amber-400 transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 text-center">
          <div className="text-2xl font-bold text-white">
            {user.ownedAgentCount}
          </div>
          <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
            <Package className="w-3 h-3" />
            Published agents
          </div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 text-center">
          <div className="text-2xl font-bold text-white">
            {user.scope ?? "\u2014"}
          </div>
          <div className="text-xs text-gray-500 mt-1">Scope</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {user.scope && (
          <Link
            to="/users/$username"
            params={{ username: user.scope }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-gray-300 hover:text-white hover:border-neutral-600 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View public profile
          </Link>
        )}
        <a
          href="https://docs.useclawstore.com/authors/publishing"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          <Package className="w-3.5 h-3.5" />
          Publish an agent
        </a>
      </div>
    </div>
  )
}
