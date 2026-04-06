import { useState, useEffect } from "react"
import { Github } from "lucide-react"
import { Button } from "./ui/button"

const REPO = "saba-ch/clawstore"

export function GitHubStars() {
  const [stars, setStars] = useState<string | null>(null)

  useEffect(() => {
    fetch(`https://api.github.com/repos/${REPO}`, {
      headers: { Accept: "application/vnd.github.v3+json" },
    })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.stargazers_count === "number") {
          setStars(
            d.stargazers_count >= 1000
              ? `${Math.round(d.stargazers_count / 1000)}k`
              : d.stargazers_count.toLocaleString()
          )
        }
      })
      .catch(() => {})
  }, [])

  return (
    <Button asChild size="sm" variant="ghost" className="h-8 shadow-none">
      <a
        href={`https://github.com/${REPO}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Github className="w-4 h-4" />
        {stars !== null && (
          <span className="text-xs text-gray-400 tabular-nums">{stars}</span>
        )}
      </a>
    </Button>
  )
}
