import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import { authClient } from "../lib/auth-client";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function UserMenu() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setSession(data);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  if (!session?.user) {
    return (
      <button
        className="inline-flex items-center h-7 px-2.5 text-[0.8rem] font-medium rounded-lg border border-neutral-700 bg-transparent text-gray-300 hover:text-white hover:bg-neutral-800 transition-colors"
        onClick={() =>
          authClient.signIn.social({
            provider: "github",
            callbackURL: window.location.href,
          })
        }
      >
        Sign in
      </button>
    );
  }

  const user = session.user;
  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((s: string) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image ?? undefined} alt={user.name} />
            <AvatarFallback className="bg-neutral-700 text-xs text-gray-300">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 bg-neutral-900 border-neutral-800"
      >
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-white">{user.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
        </div>
        <DropdownMenuSeparator className="bg-neutral-800" />
        <DropdownMenuItem asChild>
          <Link
            to="/profile"
            className="flex items-center gap-2 text-gray-300 cursor-pointer"
          >
            <User className="w-4 h-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-neutral-800" />
        <DropdownMenuItem
          className="flex items-center gap-2 text-gray-300 cursor-pointer"
          onClick={async () => {
            await authClient.signOut();
            window.location.reload();
          }}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
