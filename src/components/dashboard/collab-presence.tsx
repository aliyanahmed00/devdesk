"use client";

import { useEffect, useState } from "react";
import { Activity, MousePointer2 } from "lucide-react";
import { clsx } from "clsx";

import { Drawer } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import {
  getTeammate,
  PRESENCE_STATUS_META,
  type CollabActivity,
  type Teammate,
} from "@/lib/collab-presence";
import { formatRelativeTime } from "@/lib/relative-time";
import { useCollabPresence } from "@/components/providers/collab-presence-provider";

function PresenceAvatar({
  member,
  size = "md",
}: {
  member: Teammate;
  size?: "sm" | "md";
}) {
  const meta = PRESENCE_STATUS_META[member.status];
  const pulses = member.status !== "meeting";
  return (
    <span
      title={`${member.name} · ${meta.label}`}
      className={clsx(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-black/80 ring-2 ring-background",
        size === "sm" ? "size-7 text-[9px]" : "size-8 text-[10px]",
      )}
      style={{ backgroundColor: member.color }}
    >
      {member.initials}
      <span
        aria-hidden
        className={clsx(
          "pointer-events-none absolute -inset-0.5 rounded-full ring-2",
          meta.ring,
          pulses && "motion-safe:animate-pulse",
        )}
      />
      <span
        aria-hidden
        className={clsx(
          "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background",
          meta.dot,
        )}
      />
    </span>
  );
}

function PresenceStack({ team }: { team: Teammate[] }) {
  const shown = team.slice(0, 3);
  const overflow = team.length - shown.length;
  return (
    <span className="flex items-center">
      <span className="flex items-center -space-x-2">
        {shown.map((member) => (
          <PresenceAvatar key={member.id} member={member} />
        ))}
        {overflow > 0 && (
          <span
            title={`${overflow} more online`}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background"
          >
            +{overflow}
          </span>
        )}
      </span>
    </span>
  );
}

function ActivityRow({ activity }: { activity: CollabActivity }) {
  const member = getTeammate(activity.teammateId);
  if (!member) return null;
  return (
    <li className="flex items-start gap-3">
      <PresenceAvatar member={member} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-medium" style={{ color: member.color }}>
            {member.name}
          </span>{" "}
          <span className="text-muted-foreground">{activity.message}</span>
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {formatRelativeTime(activity.at)}
        </p>
      </div>
    </li>
  );
}

function ActivityDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { team, activities, settings, setCursorsEnabled } = useCollabPresence();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Team activity"
      description="Simulated presence across your workspace"
      icon={<Activity className="size-4" />}
    >
      <div className="flex flex-col gap-6">
        <section>
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
              Team · {team.length} online
            </h3>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-300">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
              </span>
              Live
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-1">
            {team.map((member) => {
              const meta = PRESENCE_STATUS_META[member.status];
              return (
                <li
                  key={member.id}
                  className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-muted/40"
                >
                  <PresenceAvatar member={member} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {member.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.note}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      "flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium",
                      meta.text,
                    )}
                  >
                    <span className={clsx("size-1.5 rounded-full", meta.dot)} />
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">
              Team cursor preview
            </p>
            <p className="text-[11px] text-muted-foreground">
              Animate teammate cursors across the grid.
            </p>
          </div>
          <Switch
            checked={settings.cursorsEnabled}
            onChange={setCursorsEnabled}
            label="Team cursor preview"
          />
        </div>

        <section>
          <h3 className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
            Activity stream
          </h3>
          {activities.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Waiting for the team to do something…
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3.5">
              {activities.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </Drawer>
  );
}

export function CollabPresence() {
  const { team, settings, toggleCursors } = useCollabPresence();
  const [feedOpen, setFeedOpen] = useState(false);

  return (
    <>
      <div className="hidden items-center gap-1 rounded-full border border-border/70 bg-muted/30 p-1 pl-2 md:flex">
        <PresenceStack team={team} />
        <button
          type="button"
          onClick={toggleCursors}
          aria-pressed={settings.cursorsEnabled}
          data-sound="pop"
          title="Team cursor preview"
          aria-label="Toggle team cursor preview"
          className={clsx(
            "flex size-7 items-center justify-center rounded-full transition-colors",
            settings.cursorsEnabled
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <MousePointer2 className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setFeedOpen(true)}
          data-sound="swoosh"
          title="Team activity feed"
          aria-label="Open team activity feed"
          className="relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Activity className="size-3.5" />
          <span className="hidden xl:inline">Activity</span>
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
        </button>
      </div>

      <ActivityDrawer open={feedOpen} onClose={() => setFeedOpen(false)} />
    </>
  );
}

type CursorPosition = { x: number; y: number };

const BASE_POSITIONS: CursorPosition[] = [
  { x: 16, y: 30 },
  { x: 62, y: 56 },
  { x: 34, y: 74 },
  { x: 78, y: 24 },
];

function randomPosition(): CursorPosition {
  return { x: 6 + Math.random() * 84, y: 8 + Math.random() * 78 };
}

export function CollabCursorOverlay() {
  const { team, settings } = useCollabPresence();
  const [positions, setPositions] = useState<CursorPosition[]>(() =>
    team.map(
      (_, index) => BASE_POSITIONS[index % BASE_POSITIONS.length],
    ),
  );

  useEffect(() => {
    if (!settings.cursorsEnabled) return;
    const drift = window.setInterval(() => {
      setPositions((prev) => prev.map(() => randomPosition()));
    }, 2600);
    const kick = window.setTimeout(() => {
      setPositions((prev) => prev.map(() => randomPosition()));
    }, 500);
    return () => {
      window.clearInterval(drift);
      window.clearTimeout(kick);
    };
  }, [settings.cursorsEnabled]);

  if (!settings.cursorsEnabled) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
    >
      {team.map((member, index) => {
        const position =
          positions[index] ?? BASE_POSITIONS[index % BASE_POSITIONS.length];
        return (
          <div
            key={member.id}
            className="absolute flex items-start transition-[left,top] duration-[2400ms] ease-in-out motion-reduce:transition-none"
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
              style={{ color: member.color }}
            >
              <path
                d="M5.5 3.2 19 11.3l-6.2 1.3L9.9 19 5.5 3.2Z"
                fill="currentColor"
                stroke="white"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="mt-3.5 ml-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-black/85 shadow-sm"
              style={{ backgroundColor: member.color }}
            >
              {member.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
