import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

async function DashboardContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card p-8 text-card-foreground">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="mt-1 text-lg font-medium text-foreground">
          {user.email ?? user.id}
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Your widgets will live here.
      </div>
    </section>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <header className="w-full border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="flex h-16 w-full items-center justify-between px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <LayoutDashboard className="size-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">DevDesk</span>
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main className="w-full flex-1 px-6 py-6 lg:px-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading your workspace…
            </div>
          }
        >
          <DashboardContent />
        </Suspense>
      </main>
    </div>
  );
}
