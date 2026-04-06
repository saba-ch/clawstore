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
      <Button
        variant="outline"
        size="sm"
        className="border-slate-700 text-gray-300 hover:text-white hover:bg-slate-800"
        onClick={() =>
          authClient.signIn.social({
            provider: "github",
            callbackURL: window.location.href,
          })
        }
      >
        Sign in
      </Button>
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
        <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image ?? undefined} alt={user.name} />
            <AvatarFallback className="bg-slate-700 text-xs text-gray-300">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 bg-slate-800 border-slate-700"
      >
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium text-white">{user.name}</p>
          <p className="text-xs text-gray-400">{user.email}</p>
        </div>
        <DropdownMenuSeparator className="bg-slate-700" />
        <DropdownMenuItem asChild>
          <Link
            to="/profile"
            className="flex items-center gap-2 text-gray-300 cursor-pointer"
          >
            <User className="w-4 h-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-700" />
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
