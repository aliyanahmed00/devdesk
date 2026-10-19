"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookMarked,
  Briefcase,
  ExternalLink,
  GitBranch,
  GitCommit,
  GitFork,
  GitPullRequest,
  Loader2,
  MapPin,
  MessageSquare,
  RotateCw,
  Search,
  Star,
  Tag,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { useLocalStorage } from "@/lib/use-local-storage";

const USERNAME_KEY = "devdesk:github-user";
const DEFAULT_USERNAME = "octocat";
const USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;

type GithubProfile = {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  followers: number;
  following: number;
  public_repos: number;
  html_url: string;
  location: string | null;
  company: string | null;
};

type GithubEvent = {
  id: string;
  type: string;
  repo?: { name: string };
  created_at: string;
  payload?: {
    action?: string;
    size?: number;
    ref?: string;
    ref_type?: string;
    commits?: { message: string }[];
    pull_request?: { number: number; merged?: boolean };
    issue?: { number: number };
    release?: { tag_name: string };
  };
};

type FeedItem = {
  id: string;
  kind: string;
  text: string;
  repo: string;
  url: string;
  createdAt: string;
};

type GithubData = {
  profile: GithubProfile;
  feed: FeedItem[];
  source: "live" | "sample";
};

const KIND_ICONS: Record<string, LucideIcon> = {
  push: GitCommit,
  pr: GitPullRequest,
  star: Star,
  fork: GitFork,
  branch: GitBranch,
  issue: MessageSquare,
  release: Tag,
  delete: Trash2,
  activity: GitBranch,
};

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function describeEvent(event: GithubEvent): Omit<FeedItem, "id" | "createdAt"> {
  const repo = event.repo?.name ?? "";
  const url = repo ? `https://github.com/${repo}` : `https://github.com`;
  const payload = event.payload ?? {};

  switch (event.type) {
    case "PushEvent": {
      const count = payload.size ?? payload.commits?.length ?? 1;
      return {
        kind: "push",
        text: `Pushed ${count} commit${count === 1 ? "" : "s"} to`,
        repo,
        url,
      };
    }
    case "PullRequestEvent": {
      const action = payload.pull_request?.merged
        ? "merged"
        : payload.action ?? "updated";
      return {
        kind: "pr",
        text: `${titleCase(action)} pull request #${payload.pull_request?.number ?? ""} in`,
        repo,
        url,
      };
    }
    case "PullRequestReviewEvent":
      return { kind: "pr", text: `Reviewed a pull request in`, repo, url };
    case "WatchEvent":
      return { kind: "star", text: `Starred`, repo, url };
    case "ForkEvent":
      return { kind: "fork", text: `Forked`, repo, url };
    case "CreateEvent":
      return {
        kind: "branch",
        text: `Created ${payload.ref_type ?? "ref"} ${
          payload.ref ? `“${payload.ref}”` : ""
        } in`,
        repo,
        url,
      };
    case "DeleteEvent":
      return {
        kind: "delete",
        text: `Deleted ${payload.ref_type ?? "ref"} in`,
        repo,
        url,
      };
    case "IssuesEvent":
      return {
        kind: "issue",
        text: `${titleCase(payload.action ?? "updated")} issue #${
          payload.issue?.number ?? ""
        } in`,
        repo,
        url,
      };
    case "IssueCommentEvent":
      return {
        kind: "issue",
        text: `Commented on issue #${payload.issue?.number ?? ""} in`,
        repo,
        url,
      };
    case "ReleaseEvent":
      return {
        kind: "release",
        text: `Published release ${payload.release?.tag_name ?? ""} in`,
        repo,
        url,
      };
    case "PublicEvent":
      return { kind: "activity", text: `Made public`, repo, url };
    default:
      return {
        kind: "activity",
        text: titleCase(event.type.replace(/Event$/, "")),
        repo,
        url,
      };
  }
}

function buildSampleFeed(username: string): FeedItem[] {
  const seed = hashString(username);
  const repos = [
    `${username}/dotfiles`,
    `${username}/awesome-tools`,
    `${username}/api-server`,
    `${username}/portfolio`,
    `${username}/cli`,
  ];
  const templates: { kind: string; text: string }[] = [
    { kind: "push", text: "Pushed 3 commits to" },
    { kind: "pr", text: "Opened pull request #42 in" },
    { kind: "star", text: "Starred" },
    { kind: "issue", text: "Commented on issue #17 in" },
    { kind: "fork", text: "Forked" },
    { kind: "release", text: "Published release v1.4.0 in" },
  ];

  return templates.map((template, index) => {
    const repo = repos[(seed + index) % repos.length];
    return {
      id: `sample-${index}`,
      kind: template.kind,
      text: template.text,
      repo,
      url: `https://github.com/${repo}`,
      createdAt: new Date(Date.now() - (index + 1) * 3600_000).toISOString(),
    };
  });
}

function buildSampleProfile(username: string): GithubProfile {
  const seed = hashString(username);
  return {
    login: username,
    name: titleCase(username),
    avatar_url: `https://github.com/${username}.png`,
    bio: "Building open-source tools and shipping side projects. (sample data)",
    followers: 40 + (seed % 900),
    following: 10 + (seed % 200),
    public_repos: 8 + (seed % 60),
    html_url: `https://github.com/${username}`,
    location: "Internet",
    company: null,
  };
}

function normalizeProfile(user: GithubProfile): GithubProfile {
  return {
    login: user.login,
    name: user.name,
    avatar_url: user.avatar_url,
    bio: user.bio,
    followers: user.followers,
    following: user.following,
    public_repos: user.public_repos,
    html_url: user.html_url,
    location: user.location,
    company: user.company,
  };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function GithubWidget() {
  const [username, setUsername] = useLocalStorage<string>(
    USERNAME_KEY,
    DEFAULT_USERNAME,
  );
  const [data, setData] = useState<GithubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const requestIdRef = useRef(0);

  const trimmed = username.trim();
  const valid = USERNAME_PATTERN.test(trimmed);

  useEffect(() => {
    if (!valid) return;

    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setNotice(null);
        try {
          const headers = { Accept: "application/vnd.github+json" };
          const [userRes, eventsRes] = await Promise.all([
            fetch(
              `https://api.github.com/users/${encodeURIComponent(trimmed)}`,
              { signal: controller.signal, headers },
            ),
            fetch(
              `https://api.github.com/users/${encodeURIComponent(trimmed)}/events/public`,
              { signal: controller.signal, headers },
            ),
          ]);

          if (requestIdRef.current !== requestId) return;

          if (userRes.status === 404) {
            setData(null);
            setNotice(`No GitHub user named “${trimmed}”.`);
            setLoading(false);
            return;
          }
          if (!userRes.ok) {
            throw new Error(`GitHub responded with ${userRes.status}`);
          }

          const profile = (await userRes.json()) as GithubProfile;
          const events = eventsRes.ok
            ? ((await eventsRes.json()) as GithubEvent[])
            : [];

          if (requestIdRef.current !== requestId) return;

          setData({
            profile: normalizeProfile(profile),
            feed: events.slice(0, 8).map((event) => ({
              id: event.id,
              ...describeEvent(event),
              createdAt: event.created_at,
            })),
            source: "live",
          });
          setLoading(false);
        } catch (error) {
          if (controller.signal.aborted) return;
          if (requestIdRef.current !== requestId) return;

          setData({
            profile: buildSampleProfile(trimmed),
            feed: buildSampleFeed(trimmed),
            source: "sample",
          });
          setNotice(
            error instanceof Error && /responded with/.test(error.message)
              ? "GitHub is rate-limited right now — showing sample data."
              : "Couldn't reach GitHub — showing sample data.",
          );
          setLoading(false);
        }
      })();
    }, 600);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed, valid, reloadNonce]);

  const initials = useMemo(
    () => (data ? titleCase(data.profile.login).slice(0, 2).toUpperCase() : "??"),
    [data],
  );
  const showNotice = valid && notice !== null;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            spellCheck={false}
            placeholder="GitHub username…"
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
          />
          {username && (
            <button
              type="button"
              onClick={() => setUsername("")}
              aria-label="Clear username"
              className="absolute right-2.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>
        <button
          type="button"
          onClick={() => setReloadNonce((value) => value + 1)}
          disabled={!valid || loading}
          aria-label="Reload GitHub activity"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RotateCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {showNotice && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{notice}</span>
        </p>
      )}

      {valid && loading && !data && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="size-14 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading GitHub activity…
          </div>
        </div>
      )}

      {!showNotice && (!valid || (!loading && !data)) && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Enter a GitHub username to see their activity.
        </p>
      )}

      {valid && data && (
        <>
          <div className="flex items-start gap-3">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary/30 to-primary/5">
              <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-primary">
                {initials}
              </span>
              {data.profile.avatar_url && (
                <div
                  aria-hidden
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${data.profile.avatar_url})` }}
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <a
                  href={data.profile.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm font-semibold text-foreground hover:text-primary"
                >
                  {data.profile.name ?? data.profile.login}
                </a>
                <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  @{data.profile.login}
                </span>
                {data.source === "sample" && (
                  <span className="shrink-0 rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    sample
                  </span>
                )}
              </div>
              {data.profile.bio && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {data.profile.bio}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" />
                  {data.profile.followers.toLocaleString()} followers
                </span>
                <span className="flex items-center gap-1">
                  <BookMarked className="size-3.5" />
                  {data.profile.public_repos.toLocaleString()} repos
                </span>
                {data.profile.company && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="size-3.5" />
                    {data.profile.company}
                  </span>
                )}
                {data.profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {data.profile.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={data.profile.html_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
              Profile
            </a>
            <a
              href={`${data.profile.html_url}?tab=repositories`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <BookMarked className="size-3.5" />
              Repositories
            </a>
          </div>

          <div className="scrollbar-thin -mr-1 flex max-h-64 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Recent activity
            </p>
            {data.feed.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No recent public activity.
              </p>
            ) : (
              data.feed.map((item) => {
                const Icon = KIND_ICONS[item.kind] ?? KIND_ICONS.activity;
                return (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 p-2.5 transition-colors hover:bg-muted"
                  >
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs leading-snug text-foreground">
                        {item.text}{" "}
                        {item.repo && (
                          <span className="font-medium text-primary">
                            {item.repo}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {timeAgo(item.createdAt)}
                      </span>
                    </span>
                  </a>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
