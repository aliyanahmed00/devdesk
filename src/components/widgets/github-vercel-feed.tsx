"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  CircleDot,
  GitBranch,
  GitCommit,
  GitFork,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Loader2,
  RefreshCw,
  Rocket,
  Star,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";

import { useToast } from "@/components/providers/toast-provider";
import { GitHubIcon, VercelIcon } from "@/components/ui/brand-icons";
import { Drawer } from "@/components/ui/drawer";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { isMockApiError, mockRequest } from "@/lib/api-client";
import { formatClockTime, useNow } from "@/lib/relative-time";
import { useLocalStorage } from "@/lib/use-local-storage";

/* -------------------------------------------------------------------------- */
/* Persistence                                                                */
/* -------------------------------------------------------------------------- */

export const GITHUB_VERCEL_STORAGE_KEY = "devdesk:github-vercel-feed";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Repo = {
  id: string;
  name: string;
  language: string;
  stars: number;
  forks: number;
  watchers: number;
  defaultBranch: string;
  url: string;
};

type Commit = {
  id: string;
  repoId: string;
  sha: string;
  message: string;
  author: string;
  branch: string;
  at: number;
};

type PrState = "open" | "merged" | "closed";

type PullRequest = {
  id: string;
  repoId: string;
  number: number;
  title: string;
  author: string;
  state: PrState;
  comments: number;
  at: number;
};

type Issue = {
  id: string;
  repoId: string;
  number: number;
  title: string;
  author: string;
  labels: string[];
  at: number;
};

type DeployStatus = "building" | "ready" | "error";
type DeployEnvironment = "production" | "preview";

type Deployment = {
  id: string;
  repoId: string;
  project: string;
  environment: DeployEnvironment;
  status: DeployStatus;
  commitSha: string;
  commitMessage: string;
  branch: string;
  at: number;
  durationMs: number;
  url: string;
};

type LogTone = "muted" | "info" | "success" | "error";

type BuildLogLine = {
  id: string;
  text: string;
  tone: LogTone;
  at: number;
};

type FeedState = {
  repos: Repo[];
  activeRepoId: string;
  commits: Commit[];
  prs: PullRequest[];
  issues: Issue[];
  deployments: Deployment[];
  buildLogs: Record<string, BuildLogLine[]>;
};

export type GithubVercelFeedProps = {
  /** Optional starting repo. Defaults to the persisted active repo. */
  initialRepoId?: string;
};

/* -------------------------------------------------------------------------- */
/* Deterministic seed                                                         */
/* -------------------------------------------------------------------------- */

const SEED_BASE = Date.now();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const SEED_REPOS: Repo[] = [
  {
    id: "repo-api",
    name: "acme/api-server",
    language: "TypeScript",
    stars: 1284,
    forks: 96,
    watchers: 42,
    defaultBranch: "main",
    url: "https://github.com/acme/api-server",
  },
  {
    id: "repo-web",
    name: "acme/web-app",
    language: "TypeScript",
    stars: 742,
    forks: 58,
    watchers: 27,
    defaultBranch: "main",
    url: "https://github.com/acme/web-app",
  },
  {
    id: "repo-cli",
    name: "acme/devdesk-cli",
    language: "Rust",
    stars: 318,
    forks: 21,
    watchers: 12,
    defaultBranch: "main",
    url: "https://github.com/acme/devdesk-cli",
  },
];

const SEED_COMMITS: Commit[] = [
  {
    id: "c1",
    repoId: "repo-api",
    sha: "9f2a1c4",
    message: "fix: handle null session in refresh token flow",
    author: "mira",
    branch: "main",
    at: SEED_BASE - 7 * MINUTE,
  },
  {
    id: "c2",
    repoId: "repo-api",
    sha: "b7d90ef",
    message: "perf: cache repository lookups per request",
    author: "kai",
    branch: "main",
    at: SEED_BASE - 46 * MINUTE,
  },
  {
    id: "c3",
    repoId: "repo-web",
    sha: "1ac33de",
    message: "feat: command palette keyboard navigation",
    author: "mira",
    branch: "feat/palette",
    at: SEED_BASE - 2 * HOUR,
  },
  {
    id: "c4",
    repoId: "repo-cli",
    sha: "3e0aa52",
    message: "chore: bump dependencies and drop node 18",
    author: "dev",
    branch: "main",
    at: SEED_BASE - 9 * HOUR,
  },
  {
    id: "c5",
    repoId: "repo-web",
    sha: "7ab1290",
    message: "style: refine sliding tab indicator",
    author: "sana",
    branch: "main",
    at: SEED_BASE - 26 * HOUR,
  },
];

const SEED_PRS: PullRequest[] = [
  {
    id: "pr1",
    repoId: "repo-api",
    number: 208,
    title: "Add usage metering to the gateway",
    author: "kai",
    state: "open",
    comments: 6,
    at: SEED_BASE - 32 * MINUTE,
  },
  {
    id: "pr2",
    repoId: "repo-api",
    number: 204,
    title: "Migrate to edge runtime",
    author: "mira",
    state: "merged",
    comments: 12,
    at: SEED_BASE - 5 * HOUR,
  },
  {
    id: "pr3",
    repoId: "repo-web",
    number: 96,
    title: "Redesign onboarding tour",
    author: "sana",
    state: "open",
    comments: 3,
    at: SEED_BASE - 14 * HOUR,
  },
  {
    id: "pr4",
    repoId: "repo-cli",
    number: 41,
    title: "Deprecate legacy config format",
    author: "dev",
    state: "closed",
    comments: 2,
    at: SEED_BASE - 2 * 24 * HOUR,
  },
];

const SEED_ISSUES: Issue[] = [
  {
    id: "i1",
    repoId: "repo-api",
    number: 231,
    title: "Rate limiter resets on cold start",
    author: "sana",
    labels: ["bug", "p1"],
    at: SEED_BASE - 18 * MINUTE,
  },
  {
    id: "i2",
    repoId: "repo-web",
    number: 112,
    title: "Support keyboard-only widget reordering",
    author: "kai",
    labels: ["a11y", "enhancement"],
    at: SEED_BASE - 8 * HOUR,
  },
  {
    id: "i3",
    repoId: "repo-cli",
    number: 57,
    title: "Add shell completions for zsh",
    author: "mira",
    labels: ["enhancement"],
    at: SEED_BASE - 3 * 24 * HOUR,
  },
];

const SEED_DEPLOYMENTS: Deployment[] = [
  {
    id: "d1",
    repoId: "repo-api",
    project: "api-server",
    environment: "production",
    status: "ready",
    commitSha: "9f2a1c4",
    commitMessage: "fix: handle null session in refresh token flow",
    branch: "main",
    at: SEED_BASE - 7 * MINUTE,
    durationMs: 34_000,
    url: "https://api-server.vercel.app",
  },
  {
    id: "d2",
    repoId: "repo-api",
    project: "api-server",
    environment: "preview",
    status: "building",
    commitSha: "c41b0aa",
    commitMessage: "feat: usage metering",
    branch: "feat/metering",
    at: SEED_BASE - 80_000,
    durationMs: 0,
    url: "https://api-server-git-feat-metering.vercel.app",
  },
  {
    id: "d3",
    repoId: "repo-web",
    project: "web-app",
    environment: "production",
    status: "error",
    commitSha: "1ac33de",
    commitMessage: "feat: command palette keyboard navigation",
    branch: "main",
    at: SEED_BASE - 3 * HOUR,
    durationMs: 52_000,
    url: "https://web-app.vercel.app",
  },
  {
    id: "d4",
    repoId: "repo-cli",
    project: "devdesk-cli",
    environment: "production",
    status: "ready",
    commitSha: "3e0aa52",
    commitMessage: "chore: bump dependencies and drop node 18",
    branch: "main",
    at: SEED_BASE - 9 * HOUR,
    durationMs: 41_000,
    url: "https://devdesk-cli.vercel.app",
  },
];

function seedLog(
  deploymentId: string,
  lines: [string, LogTone][],
  startedAt: number,
): Record<string, BuildLogLine[]> {
  return {
    [deploymentId]: lines.map(([text, tone], index) => ({
      id: `${deploymentId}-${index}`,
      text,
      tone,
      at: startedAt + index * 900,
    })),
  };
}

const SEED_BUILD_LOGS: Record<string, BuildLogLine[]> = {
  ...seedLog(
    "d1",
    [
      ["▲ Vercel CLI 39.2.1", "muted"],
      ["> Deploying api-server to production…", "info"],
      ["> Cloning github.com/acme/api-server (Branch: main, Commit: 9f2a1c4)", "muted"],
      ["Cloning completed: 812ms", "muted"],
      ["Running \"install\" command: pnpm install…", "info"],
      ["Packages: +512", "muted"],
      ["Running \"build\" command: pnpm build…", "info"],
      ["✓ Compiled successfully in 3.4s", "success"],
      ["✓ Generating static pages (7/7)", "success"],
      ["Build Completed in 12.6s", "success"],
      ["▲ Production deployment ready", "success"],
    ],
    SEED_BASE - 8 * MINUTE,
  ),
  ...seedLog(
    "d2",
    [
      ["▲ Vercel CLI 39.2.1", "muted"],
      ["> Deploying api-server to preview…", "info"],
      ["Running \"install\" command: pnpm install…", "info"],
      ["Packages: +512", "muted"],
      ["Running \"build\" command: pnpm build…", "info"],
      ["▲ Next.js 16.4.0 (Turbopack)", "muted"],
    ],
    SEED_BASE - 80_000,
  ),
  ...seedLog(
    "d3",
    [
      ["▲ Vercel CLI 39.2.1", "muted"],
      ["> Deploying web-app to production…", "info"],
      ["Running \"build\" command: pnpm build…", "info"],
      ["✓ Compiled successfully in 4.1s", "success"],
      ["Failed to compile.", "error"],
      ["Type error: Property 'onOpenNetworkLog' does not exist on type 'Props'.", "error"],
      ["Error: Command \"pnpm build\" exited with 1", "error"],
    ],
    SEED_BASE - 3 * HOUR,
  ),
};

const SEED_STATE: FeedState = {
  repos: SEED_REPOS,
  activeRepoId: SEED_REPOS[0].id,
  commits: SEED_COMMITS,
  prs: SEED_PRS,
  issues: SEED_ISSUES,
  deployments: SEED_DEPLOYMENTS,
  buildLogs: SEED_BUILD_LOGS,
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatAgo(at: number, now: number): string {
  if (!now) return "just now";
  const seconds = Math.round(Math.max(0, now - at) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

function shortSha(): string {
  return Math.random().toString(16).slice(2, 9);
}

const COMMIT_MESSAGES = [
  "feat: add granular cache revalidation",
  "fix: guard against undefined workspace profile",
  "refactor: extract shared toast provider",
  "chore: tighten eslint rules",
  "perf: memoize feed selectors",
  "docs: document mock api layer",
];

const PR_TITLES = [
  "Add per-widget error boundaries",
  "Introduce network throttling devtools",
  "Support OLED theme tokens",
  "Ship the workspace import/export flow",
];

const ISSUE_TITLES = [
  "Deployments list flickers on refetch",
  "Add retry to failed widget requests",
  "Relative timestamps drift after tab sleep",
];

const AUTHORS = ["mira", "kai", "sana", "dev", "leo"];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function makeCommit(repo: Repo): Commit {
  return {
    id: crypto.randomUUID(),
    repoId: repo.id,
    sha: shortSha(),
    message: pick(COMMIT_MESSAGES),
    author: pick(AUTHORS),
    branch: repo.defaultBranch,
    at: Date.now(),
  };
}

function makeActivity(prev: FeedState): FeedState {
  const repo =
    prev.repos.find((item) => item.id === prev.activeRepoId) ?? prev.repos[0];
  const roll = Math.random();

  if (roll < 0.62) {
    return {
      ...prev,
      commits: [makeCommit(repo), ...prev.commits].slice(0, 40),
    };
  }
  if (roll < 0.82) {
    const pr: PullRequest = {
      id: crypto.randomUUID(),
      repoId: repo.id,
      number: 200 + Math.floor(Math.random() * 90),
      title: pick(PR_TITLES),
      author: pick(AUTHORS),
      state: "open",
      comments: 0,
      at: Date.now(),
    };
    return {
      ...prev,
      prs: [pr, ...prev.prs].slice(0, 30),
    };
  }
  const issue: Issue = {
    id: crypto.randomUUID(),
    repoId: repo.id,
    number: 100 + Math.floor(Math.random() * 120),
    title: pick(ISSUE_TITLES),
    author: pick(AUTHORS),
    labels: [pick(["bug", "enhancement", "a11y", "p2"])],
    at: Date.now(),
  };
  return {
    ...prev,
    issues: [issue, ...prev.issues].slice(0, 30),
  };
}

function buildScript(dep: Deployment, willFail: boolean): [string, LogTone][] {
  const header: [string, LogTone][] = [
    ["▲ Vercel CLI 39.2.1", "muted"],
    [`> Deploying ${dep.project} to ${dep.environment}…`, "info"],
    [
      `> Cloning github.com/${dep.repoId} (Branch: ${dep.branch}, Commit: ${dep.commitSha})`,
      "muted",
    ],
    ["Cloning completed: 812ms", "muted"],
    ["> Restored build cache from previous deployment", "muted"],
    [`Running "install" command: pnpm install…`, "info"],
    ["Packages: +512", "muted"],
    [`Running "build" command: pnpm build…`, "info"],
    ["▲ Next.js 16.4.0 (Turbopack)", "muted"],
    ["✓ Compiled successfully in 3.4s", "success"],
  ];

  if (willFail) {
    return [
      ...header,
      ["Failed to compile.", "error"],
      ["Type error: Cannot find module '@/lib/api-client'.", "error"],
      [`Error: Command "pnpm build" exited with 1`, "error"],
    ];
  }

  return [
    ...header,
    ["✓ Generating static pages (7/7)", "success"],
    ["Route (app)  ○ /  ○ /login  ƒ /api/transpile", "muted"],
    ["Build Completed in 12.6s", "success"],
    ["Uploading build outputs…", "info"],
    ["Compression: gzip — 142 KB", "muted"],
    ["▲ Production deployment ready", "success"],
    [`${dep.url}`, "success"],
  ];
}

const LOG_TONE: Record<LogTone, string> = {
  muted: "text-emerald-500/70",
  info: "text-sky-300",
  success: "text-emerald-400",
  error: "text-rose-400",
};

type ActivityFilter = "all" | "commits" | "prs" | "issues";

const FILTER_TABS: readonly TabItem<ActivityFilter>[] = [
  { id: "all", label: "All" },
  { id: "commits", label: "Commits" },
  { id: "prs", label: "PRs" },
  { id: "issues", label: "Issues" },
];

type ActivityItem =
  | { kind: "commit"; id: string; at: number; commit: Commit }
  | { kind: "pr"; id: string; at: number; pr: PullRequest }
  | { kind: "issue"; id: string; at: number; issue: Issue };

const PR_META: Record<PrState, { label: string; icon: LucideIcon; className: string }> = {
  open: {
    label: "Open",
    icon: GitPullRequest,
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  },
  merged: {
    label: "Merged",
    icon: GitMerge,
    className: "border-violet-500/40 bg-violet-500/10 text-violet-400",
  },
  closed: {
    label: "Closed",
    icon: GitPullRequestClosed,
    className: "border-rose-500/40 bg-rose-500/10 text-rose-400",
  },
};

const DEPLOY_META: Record<
  DeployStatus,
  { label: string; icon: LucideIcon; dot: string; badge: string; spin?: boolean }
> = {
  building: {
    label: "Building",
    icon: Loader2,
    dot: "bg-sky-400",
    badge: "border-sky-500/40 bg-sky-500/10 text-sky-400",
    spin: true,
  },
  ready: {
    label: "Ready",
    icon: CheckCircle2,
    dot: "bg-emerald-500",
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  },
  error: {
    label: "Error",
    icon: XCircle,
    dot: "bg-rose-500",
    badge: "border-rose-500/40 bg-rose-500/10 text-rose-400",
  },
};

/* -------------------------------------------------------------------------- */
/* Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function BuildTerminal({
  lines,
  title,
  streaming,
}: {
  lines: BuildLogLine[];
  title: string;
  streaming: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-500/25 bg-zinc-950 font-mono text-xs shadow-inner">
      <div className="flex items-center gap-2 border-b border-emerald-500/20 bg-black/40 px-3 py-2">
        <span className="size-2.5 rounded-full bg-rose-500/80" />
        <span className="size-2.5 rounded-full bg-amber-500/80" />
        <span className="size-2.5 rounded-full bg-emerald-500/80" />
        <span className="ml-2 truncate text-[11px] text-emerald-500/70">
          {title}
        </span>
        {streaming && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-sky-400">
            <span className="size-1.5 animate-pulse rounded-full bg-sky-400" />
            live
          </span>
        )}
      </div>
      <div
        ref={ref}
        className="scrollbar-thin h-80 overflow-y-auto p-3 leading-relaxed"
      >
        {lines.length === 0 ? (
          <p className="text-emerald-500/50">waiting for build output…</p>
        ) : (
          lines.map((line) => (
            <p key={line.id} className="whitespace-pre-wrap">
              <span className="text-emerald-500/35 tabular-nums">
                {formatClockTime(line.at)}
              </span>{" "}
              <span className={LOG_TONE[line.tone]}>{line.text}</span>
            </p>
          ))
        )}
        {streaming && <span className="animate-blink text-emerald-400">▍</span>}
      </div>
    </div>
  );
}

function ActivityRow({
  item,
  now,
}: {
  item: ActivityItem;
  now: number;
}) {
  if (item.kind === "commit") {
    return (
      <li className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 p-2.5">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <GitCommit className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-foreground">{item.commit.message}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="font-mono text-primary">{item.commit.sha}</span>
            <span>· {item.commit.author}</span>
            <span className="flex items-center gap-0.5">
              <GitBranch className="size-2.5" />
              {item.commit.branch}
            </span>
            <span>· {formatAgo(item.at, now)}</span>
          </p>
        </div>
      </li>
    );
  }

  if (item.kind === "pr") {
    const meta = PR_META[item.pr.state];
    const Icon = meta.icon;
    return (
      <li className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 p-2.5">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-foreground">
            <span className="text-muted-foreground">#{item.pr.number}</span>{" "}
            {item.pr.title}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <span
              className={clsx(
                "rounded-full border px-1.5 py-px font-medium",
                meta.className,
              )}
            >
              {meta.label}
            </span>
            <span>· {item.pr.author}</span>
            <span>· {item.pr.comments} comments</span>
            <span>· {formatAgo(item.at, now)}</span>
          </p>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 p-2.5">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <CircleDot className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-foreground">
          <span className="text-muted-foreground">#{item.issue.number}</span>{" "}
          {item.issue.title}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          {item.issue.labels.map((label) => (
            <span
              key={label}
              className="rounded-full border border-border px-1.5 py-px font-medium"
            >
              {label}
            </span>
          ))}
          <span>· {item.issue.author}</span>
          <span>· {formatAgo(item.at, now)}</span>
        </p>
      </div>
    </li>
  );
}

function DeploymentRow({
  deployment,
  now,
  lastLine,
  onOpen,
}: {
  deployment: Deployment;
  now: number;
  lastLine?: BuildLogLine;
  onOpen: () => void;
}) {
  const meta = DEPLOY_META[deployment.status];
  const Icon = meta.icon;
  const building = deployment.status === "building";

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-lg border border-border bg-muted/20 p-2.5 text-left transition-colors hover:bg-muted"
      >
        <div className="flex items-center gap-2">
          <span className="relative flex size-2 shrink-0">
            {building && (
              <span
                className={clsx(
                  "absolute inline-flex size-full animate-ping rounded-full opacity-75",
                  meta.dot,
                )}
              />
            )}
            <span
              className={clsx("relative inline-flex size-2 rounded-full", meta.dot)}
            />
          </span>
          <VercelIcon className="size-3.5 shrink-0 text-foreground/70" />
          <span className="truncate text-xs font-medium text-foreground">
            {deployment.project}
          </span>
          <span className="shrink-0 rounded-full border border-border px-1.5 py-px text-[10px] font-medium text-muted-foreground">
            {deployment.environment}
          </span>
          <span
            className={clsx(
              "flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium",
              meta.badge,
            )}
          >
            <Icon className={clsx("size-3", meta.spin && "animate-spin")} />
            {meta.label}
          </span>
          <ChevronRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <GitBranch className="size-3" />
            {deployment.branch}
          </span>
          <span className="font-mono">{deployment.commitSha}</span>
          <span>· {formatAgo(deployment.at, now)}</span>
          {!building && deployment.durationMs > 0 && (
            <span>· {Math.round(deployment.durationMs / 1000)}s</span>
          )}
        </div>

        <p className="mt-1 truncate text-[11px] text-muted-foreground/80">
          {deployment.commitMessage}
        </p>

        {building && lastLine && (
          <p className="mt-1 truncate font-mono text-[10px] text-sky-400/80">
            {lastLine.text}
          </p>
        )}
      </button>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Widget                                                                     */
/* -------------------------------------------------------------------------- */

function normalizeFeed(value: Partial<FeedState> | null | undefined): FeedState {
  const repos = value?.repos?.length ? value.repos : SEED_STATE.repos;
  const activeRepoId =
    value?.activeRepoId && repos.some((repo) => repo.id === value.activeRepoId)
      ? value.activeRepoId
      : repos[0].id;
  return {
    repos,
    activeRepoId,
    commits: value?.commits ?? [],
    prs: value?.prs ?? [],
    issues: value?.issues ?? [],
    deployments: value?.deployments ?? [],
    buildLogs: value?.buildLogs ?? {},
  };
}

export function GithubVercelFeed({ initialRepoId }: GithubVercelFeedProps) {
  const { toast } = useToast();
  const now = useNow(15_000);
  const [state, setState] = useLocalStorage<FeedState>(
    GITHUB_VERCEL_STORAGE_KEY,
    SEED_STATE,
  );

  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [live, setLive] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [openDeployId, setOpenDeployId] = useState<string | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);

  const feed = useMemo(() => normalizeFeed(state), [state]);

  const scriptRef = useRef<[string, LogTone][]>([]);
  const failRef = useRef(false);

  useEffect(() => {
    if (!initialRepoId) return;
    setState((prev) =>
      prev.activeRepoId === initialRepoId
        ? prev
        : { ...prev, activeRepoId: initialRepoId },
    );
  }, [initialRepoId, setState]);

  const activeRepo =
    feed.repos.find((repo) => repo.id === feed.activeRepoId) ?? feed.repos[0];

  const activity = useMemo<ActivityItem[]>(() => {
    const commits: ActivityItem[] = feed.commits
      .filter((commit) => commit.repoId === activeRepo.id)
      .map((commit) => ({
        kind: "commit",
        id: `commit-${commit.id}`,
        at: commit.at,
        commit,
      }));
    const prs: ActivityItem[] = feed.prs
      .filter((pr) => pr.repoId === activeRepo.id)
      .map((pr) => ({ kind: "pr", id: `pr-${pr.id}`, at: pr.at, pr }));
    const issues: ActivityItem[] = feed.issues
      .filter((issue) => issue.repoId === activeRepo.id)
      .map((issue) => ({
        kind: "issue",
        id: `issue-${issue.id}`,
        at: issue.at,
        issue,
      }));

    const all = [...commits, ...prs, ...issues].sort((a, b) => b.at - a.at);

    if (filter === "all") return all;
    const wanted = filter === "commits" ? "commit" : filter === "prs" ? "pr" : "issue";
    return all.filter((item) => item.kind === wanted);
  }, [feed.commits, feed.prs, feed.issues, activeRepo.id, filter]);

  const deployments = useMemo(
    () =>
      feed.deployments
        .filter((deployment) => deployment.repoId === activeRepo.id)
        .sort((a, b) => b.at - a.at),
    [feed.deployments, activeRepo.id],
  );

  const openPrCount = feed.prs.filter(
    (pr) => pr.repoId === activeRepo.id && pr.state === "open",
  ).length;
  const openIssueCount = feed.issues.filter(
    (issue) => issue.repoId === activeRepo.id,
  ).length;

  const openDeployment = openDeployId
    ? feed.deployments.find((deployment) => deployment.id === openDeployId) ?? null
    : null;
  const openLogs = openDeployId ? feed.buildLogs[openDeployId] ?? [] : [];

  // Live GitHub activity stream.
  useEffect(() => {
    if (!live) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setState((prev) => makeActivity(prev));
    }, 18_000);
    return () => window.clearInterval(interval);
  }, [live, setState]);

  // Stream build logs for a redeploy.
  useEffect(() => {
    if (!streamingId) return;
    const id = streamingId;
    const script = scriptRef.current;
    let cancelled = false;
    let index = 0;
    const timers: number[] = [];

    const step = () => {
      if (cancelled) return;
      const entry = script[index];
      if (!entry) {
        const failed = failRef.current;
        setState((prev) => ({
          ...prev,
          deployments: prev.deployments.map((deployment) =>
            deployment.id === id
              ? {
                  ...deployment,
                  status: failed ? "error" : "ready",
                  durationMs: Date.now() - deployment.at,
                }
              : deployment,
          ),
        }));
        setStreamingId(null);
        return;
      }

      setState((prev) => ({
        ...prev,
        buildLogs: {
          ...prev.buildLogs,
          [id]: [
            ...(prev.buildLogs[id] ?? []),
            { id: crypto.randomUUID(), text: entry[0], tone: entry[1], at: Date.now() },
          ],
        },
      }));
      index += 1;
      timers.push(window.setTimeout(step, 240 + Math.random() * 280));
    };

    timers.push(window.setTimeout(step, 240));

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [streamingId, setState]);

  const syncGithub = useCallback(async () => {
    setSyncing(true);
    try {
      await mockRequest<boolean>({
        url: `/api/github/repos/${activeRepo.name}/events`,
        source: "GitHub",
        payload: { repo: activeRepo.name },
      });
      setState((prev) => ({
        ...prev,
        commits: [makeCommit(activeRepo), ...prev.commits].slice(0, 40),
      }));
      toast(`Synced latest activity from ${activeRepo.name}`, "success");
    } catch (cause) {
      toast(
        isMockApiError(cause) ? cause.message : "Could not reach GitHub.",
        "error",
      );
    } finally {
      setSyncing(false);
    }
  }, [activeRepo, setState, toast]);

  const triggerRedeploy = useCallback(() => {
    const repo = activeRepo;
    const project = repo.name.split("/").pop() ?? repo.name;
    const id = crypto.randomUUID();
    const willFail = Math.random() < 0.2;
    const sha = shortSha();
    const message = pick(COMMIT_MESSAGES);
    const deployment: Deployment = {
      id,
      repoId: repo.id,
      project,
      environment: "production",
      status: "building",
      commitSha: sha,
      commitMessage: message,
      branch: repo.defaultBranch,
      at: Date.now(),
      durationMs: 0,
      url: `https://${project}.vercel.app`,
    };

    scriptRef.current = buildScript(deployment, willFail);
    failRef.current = willFail;

    setState((prev) => ({
      ...prev,
      deployments: [deployment, ...prev.deployments].slice(0, 30),
      buildLogs: { ...prev.buildLogs, [id]: [] },
    }));
    setOpenDeployId(id);
    setStreamingId(id);
    toast(`Redeploying ${project} to production…`, "info");
  }, [activeRepo, setState, toast]);

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
      {/* GitHub activity stream */}
      <section className="flex min-h-0 flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-zinc-500/15 text-zinc-300 ring-1 ring-inset ring-zinc-400/25">
            <GitHubIcon className="size-4" />
          </span>
          <select
            value={activeRepo.id}
            onChange={(event) =>
              setState((prev) => ({ ...prev, activeRepoId: event.target.value }))
            }
            aria-label="Active repository"
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/60"
          >
              {feed.repos.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={syncGithub}
            disabled={syncing}
            aria-label="Sync GitHub activity"
            title="Sync activity"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={clsx("size-3.5", syncing && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={() => setLive((value) => !value)}
            aria-pressed={live}
            title={live ? "Pause live updates" : "Resume live updates"}
            className={clsx(
              "flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-colors",
              live
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            <span className="relative flex size-1.5">
              {live && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              )}
              <span
                className={clsx(
                  "relative inline-flex size-1.5 rounded-full",
                  live ? "bg-emerald-500" : "bg-muted-foreground",
                )}
              />
            </span>
            {live ? "Live" : "Paused"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="size-3.5 text-amber-400" />
            {activeRepo.stars.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <GitFork className="size-3.5" />
            {activeRepo.forks.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <GitPullRequest className="size-3.5" />
            {openPrCount} open
          </span>
          <span className="flex items-center gap-1">
            <CircleDot className="size-3.5" />
            {openIssueCount} issues
          </span>
          <span className="ml-auto hidden font-mono text-[10px] text-muted-foreground/70 sm:inline">
            {activeRepo.language}
          </span>
        </div>

        <Tabs
          tabs={FILTER_TABS}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter GitHub activity"
          size="sm"
        />

        <ul className="scrollbar-thin -mr-1 flex max-h-[22rem] min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
          {activity.length === 0 ? (
            <li className="py-8 text-center text-xs text-muted-foreground">
              No {filter} activity for {activeRepo.name}.
            </li>
          ) : (
            activity.map((item) => (
              <ActivityRow key={item.id} item={item} now={now} />
            ))
          )}
        </ul>
      </section>

      {/* Vercel deployment telemetry */}
      <section className="flex min-h-0 flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-400/25">
            <VercelIcon className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">
              Deployments
            </p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">
              {activeRepo.name}
            </p>
          </div>
          <button
            type="button"
            onClick={triggerRedeploy}
            disabled={streamingId !== null}
            className="btn-primary flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Rocket className="size-3.5" />
            Redeploy
          </button>
        </div>

        <ul className="scrollbar-thin -mr-1 flex max-h-[22rem] min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
          {deployments.length === 0 ? (
            <li className="py-8 text-center text-xs text-muted-foreground">
              No deployments yet — hit Redeploy to ship one.
            </li>
          ) : (
            deployments.map((deployment) => {
              const logs = feed.buildLogs[deployment.id] ?? [];
              return (
                <DeploymentRow
                  key={deployment.id}
                  deployment={deployment}
                  now={now}
                  lastLine={logs[logs.length - 1]}
                  onOpen={() => setOpenDeployId(deployment.id)}
                />
              );
            })
          )}
        </ul>
      </section>

      <Drawer
        open={openDeployment !== null}
        onClose={() => setOpenDeployId(null)}
        width="lg"
        title={openDeployment ? `${openDeployment.project} · build logs` : "Build logs"}
        description={
          openDeployment
            ? `${openDeployment.environment} · ${openDeployment.branch} · ${openDeployment.commitSha}`
            : undefined
        }
        icon={
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-400/25">
            <VercelIcon className="size-4" />
          </span>
        }
        footer={
          openDeployment ? (
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {(() => {
                  const meta = DEPLOY_META[openDeployment.status];
                  const Icon = meta.icon;
                  return (
                    <>
                      <Icon
                        className={clsx("size-3.5", meta.spin && "animate-spin")}
                      />
                      {meta.label}
                      {openDeployment.status !== "building" &&
                        openDeployment.durationMs > 0 && (
                          <span>· {Math.round(openDeployment.durationMs / 1000)}s</span>
                        )}
                    </>
                  );
                })()}
              </span>
              <a
                href={openDeployment.url}
                target="_blank"
                rel="noreferrer"
                className="btn-surface rounded-lg px-3 py-2 text-xs font-medium"
              >
                Visit deployment
              </a>
            </div>
          ) : undefined
        }
      >
        {openDeployment && (
          <BuildTerminal
            lines={openLogs}
            title={`build · ${openDeployment.commitSha}`}
            streaming={streamingId === openDeployment.id}
          />
        )}
      </Drawer>
    </div>
  );
}
