export type IntegrationId =
  | "github"
  | "vercel"
  | "docker"
  | "supabase"
  | "figma"
  | "linear";

export type IntegrationStatus = "connected" | "disconnected" | "syncing";

export type SyncTone = "success" | "info" | "error";

export type IntegrationField = {
  key: string;
  label: string;
  placeholder: string;
  type: "password" | "text" | "url";
  optional?: boolean;
  hint?: string;
};

export type IntegrationDefinition = {
  id: IntegrationId;
  name: string;
  description: string;
  category: string;
  /** Tailwind classes for the icon tile background + ring. */
  tile: string;
  /** Tailwind text color applied to the brand glyph. */
  glyph: string;
  fields: IntegrationField[];
  syncMessages: string[];
};

export type IntegrationConnection = {
  status: IntegrationStatus;
  values: Record<string, string>;
  lastSyncedAt: number | null;
};

export type SyncEvent = {
  id: string;
  integrationId: IntegrationId;
  message: string;
  tone: SyncTone;
  at: number;
};

export type IntegrationsState = {
  connections: Record<IntegrationId, IntegrationConnection>;
  events: SyncEvent[];
};

export const INTEGRATIONS_STORAGE_KEY = "devdesk:integrations";

export const INTEGRATION_ORDER: IntegrationId[] = [
  "github",
  "vercel",
  "docker",
  "supabase",
  "figma",
  "linear",
];

export const INTEGRATION_CATALOG: Record<IntegrationId, IntegrationDefinition> = {
  github: {
    id: "github",
    name: "GitHub",
    description: "Sync repositories, commits and pull request activity.",
    category: "Source control",
    tile: "bg-zinc-500/15 ring-zinc-400/25",
    glyph: "text-zinc-300",
    fields: [
      {
        key: "token",
        label: "Personal access token",
        placeholder: "ghp_••••••••••••••••••••",
        type: "password",
        hint: "Scopes: repo, read:user",
      },
    ],
    syncMessages: [
      "Synced {n} new commits",
      "Merged {n} pull requests",
      "Indexed {n} repositories",
    ],
  },
  vercel: {
    id: "vercel",
    name: "Vercel",
    description: "Track preview and production deployments in real time.",
    category: "Hosting",
    tile: "bg-sky-500/15 ring-sky-400/25",
    glyph: "text-sky-300",
    fields: [
      {
        key: "token",
        label: "API token",
        placeholder: "vercel_••••••••••••••••",
        type: "password",
      },
      {
        key: "webhook",
        label: "Webhook signing secret",
        placeholder: "whsec_••••••••••••••••",
        type: "password",
        optional: true,
      },
    ],
    syncMessages: [
      "Deployment success",
      "Preview build ready",
      "{n} deployments promoted",
    ],
  },
  docker: {
    id: "docker",
    name: "Docker",
    description: "Inspect containers, images and registry state at a glance.",
    category: "Containers",
    tile: "bg-blue-500/15 ring-blue-400/25",
    glyph: "text-blue-300",
    fields: [
      {
        key: "endpoint",
        label: "Engine endpoint",
        placeholder: "tcp://localhost:2375",
        type: "text",
      },
      {
        key: "token",
        label: "Registry token",
        placeholder: "dckr_pat_••••••••••••",
        type: "password",
        optional: true,
      },
    ],
    syncMessages: [
      "Pulled {n} images",
      "Pruned {n} dangling containers",
      "Registry index refreshed",
    ],
  },
  supabase: {
    id: "supabase",
    name: "Supabase",
    description: "Manage projects, tables and edge functions.",
    category: "Backend",
    tile: "bg-emerald-500/15 ring-emerald-400/25",
    glyph: "text-emerald-300",
    fields: [
      {
        key: "url",
        label: "Project URL",
        placeholder: "https://xyzcompany.supabase.co",
        type: "url",
      },
      {
        key: "key",
        label: "Service role key",
        placeholder: "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
        type: "password",
      },
    ],
    syncMessages: [
      "Schema in sync",
      "Applied {n} migrations",
      "Fetched {n} table policies",
    ],
  },
  figma: {
    id: "figma",
    name: "Figma",
    description: "Import design tokens and component libraries.",
    category: "Design",
    tile: "bg-orange-500/15 ring-orange-400/25",
    glyph: "text-orange-300",
    fields: [
      {
        key: "token",
        label: "Personal access token",
        placeholder: "figd_••••••••••••••••••",
        type: "password",
      },
    ],
    syncMessages: [
      "Imported {n} components",
      "Design tokens refreshed",
      "Synced {n} frames",
    ],
  },
  linear: {
    id: "linear",
    name: "Linear",
    description: "Track issues, cycles and project roadmaps.",
    category: "Project tracking",
    tile: "bg-indigo-500/15 ring-indigo-400/25",
    glyph: "text-indigo-300",
    fields: [
      {
        key: "key",
        label: "API key",
        placeholder: "lin_api_••••••••••••••••",
        type: "password",
      },
    ],
    syncMessages: [
      "Synced {n} issues",
      "Cycle progress updated",
      "Imported {n} roadmap items",
    ],
  },
};

const SEED_BASE = Date.now();

const SEED_EVENTS: SyncEvent[] = [
  {
    id: "seed-github",
    integrationId: "github",
    message: "Synced 4 new commits",
    tone: "success",
    at: SEED_BASE - 1000 * 60 * 5,
  },
  {
    id: "seed-vercel",
    integrationId: "vercel",
    message: "Deployment success",
    tone: "success",
    at: SEED_BASE - 1000 * 60 * 12,
  },
  {
    id: "seed-linear",
    integrationId: "linear",
    message: "Synced 7 issues",
    tone: "info",
    at: SEED_BASE - 1000 * 60 * 38,
  },
];

export function createDefaultConnections(): Record<
  IntegrationId,
  IntegrationConnection
> {
  const entries = INTEGRATION_ORDER.map((id) => {
    const values: Record<string, string> = {};
    for (const field of INTEGRATION_CATALOG[id].fields) values[field.key] = "";
    return [
      id,
      { status: "disconnected", values, lastSyncedAt: null } satisfies IntegrationConnection,
    ] as const;
  });

  return Object.fromEntries(entries) as Record<IntegrationId, IntegrationConnection>;
}

export function createDefaultState(): IntegrationsState {
  return {
    connections: createDefaultConnections(),
    events: SEED_EVENTS,
  };
}

export function fillSyncMessage(template: string): string {
  return template.replace("{n}", String(1 + Math.floor(Math.random() * 9)));
}
