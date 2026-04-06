import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { authClient } from "../lib/auth-client";

type DeviceSearch = { user_code?: string };

export const Route = createFileRoute("/device")({
  validateSearch: (search: Record<string, unknown>): DeviceSearch => ({
    user_code: search.user_code as string | undefined,
  }),
  component: DevicePage,
});

function DevicePage() {
  const { user_code } = Route.useSearch();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setSession(data);
      setLoading(false);
    });
  }, []);

  const handleSignIn = () => {
    authClient.signIn.social({
      provider: "github",
      callbackURL: `${window.location.origin}/device?user_code=${user_code}`,
    });
  };

  const handleApprove = async () => {
    if (!user_code || submitting) return;
    setSubmitting(true);
    const { error } = await authClient.device.approve({ userCode: user_code });
    if (error) {
      setResult({ type: "error", message: error.message ?? "Failed to approve" });
      setSubmitting(false);
    } else {
      setResult({
        type: "success",
        message: "Approved! Return to your terminal.",
      });
    }
  };

  const handleDeny = async () => {
    if (!user_code || submitting) return;
    setSubmitting(true);
    await authClient.device.deny({ userCode: user_code });
    setResult({ type: "error", message: "Denied. You can close this tab." });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user_code) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-8 max-w-sm w-full text-center">
          <h1 className="text-xl font-semibold text-white mb-2">
            No device code provided
          </h1>
          <p className="text-sm text-gray-400">
            Start the login flow from your terminal with{" "}
            <code className="text-amber-400">clawstore login</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-8 max-w-sm w-full text-center">
        <h1 className="text-xl font-semibold text-white mb-2">
          Authorize CLI
        </h1>
        <p className="text-sm text-gray-400 mb-6">
          The Clawstore CLI is requesting access to your account.
        </p>

        {/* Device code */}
        <div className="font-mono text-3xl font-bold tracking-widest text-amber-400 bg-neutral-900 rounded-lg py-3 px-6 mb-6 inline-block">
          {user_code}
        </div>

        <p className="text-sm text-gray-400 mb-6">
          Confirm this code matches what your terminal shows.
        </p>

        {result ? (
          <p
            className={
              result.type === "success" ? "text-green-400" : "text-red-400"
            }
          >
            {result.message}
          </p>
        ) : !session?.user ? (
          /* Not signed in */
          <button
            onClick={handleSignIn}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            Sign in with GitHub
          </button>
        ) : (
          /* Signed in — show approve/deny */
          <div className="flex justify-center gap-3">
            <button
              onClick={handleApprove}
              disabled={submitting}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Approve
            </button>
            <button
              onClick={handleDeny}
              disabled={submitting}
              className="px-6 py-2.5 bg-neutral-700 hover:bg-neutral-600 text-gray-300 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Deny
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
