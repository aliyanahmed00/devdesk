"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  LayoutDashboard,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type Pending = null | "login" | "signup";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function reset() {
    setError(null);
    setNotice(null);
  }

  async function handleLogIn() {
    reset();
    setPending("login");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }
      if (!data.session) {
        setError("No session was returned. Please try again.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach Supabase. Check your .env.local settings.");
    } finally {
      setPending(null);
    }
  }

  async function handleSignUp() {
    reset();
    setPending("signup");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setNotice("Check your email for a confirmation link to finish signing up.");
      }
    } catch {
      setError("Could not reach Supabase. Check your .env.local settings.");
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <LayoutDashboard className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Welcome back to DevDesk
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to open your dashboard.
            </p>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleLogIn();
          }}
          className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl shadow-black/20"
        >
          <label className="block" htmlFor="email">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              Email
            </span>
            <span className="relative block">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted-foreground">
                <Mail className="size-4" />
              </span>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
              />
            </span>
          </label>

          <label className="mt-4 block" htmlFor="password">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              Password
            </span>
            <span className="relative block">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted-foreground">
                <Lock className="size-4" />
              </span>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={
                  pending === "signup" ? "new-password" : "current-password"
                }
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
              />
            </span>
          </label>

          <div className="mt-4 min-h-5" aria-live="polite">
            {error && (
              <p className="flex items-start gap-2 text-sm text-rose-500">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </p>
            )}
            {notice && (
              <p className="flex items-start gap-2 text-sm text-emerald-500">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>{notice}</span>
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending === "login" && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Log In
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSignUp()}
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending === "signup" && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Sign Up
            </button>
          </div>
        </form>

        <p className="mt-6 flex items-center justify-center gap-1 text-sm text-muted-foreground">
          <Link
            href="/"
            className="transition-colors hover:text-foreground"
          >
            Back to home
          </Link>
          <ArrowRight className="size-3.5" />
        </p>
      </div>
    </div>
  );
}
