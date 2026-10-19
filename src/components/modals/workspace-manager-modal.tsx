"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import {
  Boxes,
  Check,
  Copy,
  Download,
  HardDrive,
  Pencil,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/providers/toast-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";
import {
  WORKSPACE_PRESETS,
  enabledWidgetIds,
  estimateBytes,
  formatBytes,
} from "@/lib/workspace";
import { formatRelativeTime } from "@/lib/relative-time";

type WorkspaceManagerModalProps = {
  open: boolean;
  onClose: () => void;
};

export function WorkspaceManagerModal({
  open,
  onClose,
}: WorkspaceManagerModalProps) {
  if (!open) return null;
  return <WorkspaceManagerContent onClose={onClose} />;
}

function WorkspaceManagerContent({ onClose }: { onClose: () => void }) {
  const {
    profiles,
    activeId,
    switchTo,
    createProfile,
    createFromPreset,
    duplicateProfile,
    renameProfile,
    deleteProfile,
    resetActiveLayout,
    exportActive,
    importWorkspace,
    readLiveData,
  } = useWorkspace();
  const { toast } = useToast();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const liveData = readLiveData();

  const activeWidgets = enabledWidgetIds(liveData);
  const storageSize = formatBytes(estimateBytes(liveData));
  const storedKeys = Object.keys(liveData).length;
  const targetProfile = profiles.find((profile) => profile.id === deleteTarget);

  function widgetCountFor(id: string, data: Record<string, unknown>) {
    return enabledWidgetIds(id === activeId ? liveData : data).length;
  }

  function commitRename(id: string) {
    renameProfile(id, draftName);
    setEditingId(null);
    setDraftName("");
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const isJson =
      file.type === "application/json" || file.name.endsWith(".json");
    if (!isJson) {
      toast("Please choose a .json workspace file", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importWorkspace(String(reader.result));
      if (ok) onClose();
    };
    reader.onerror = () => toast("Could not read that file", "error");
    reader.readAsText(file);
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Workspace manager"
        size="xl"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Profiles */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                  {"// profiles"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Each profile keeps its own layout, widgets and settings.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                {profiles.length} total
              </span>
            </div>

            <ul className="flex flex-col gap-2">
              {profiles.map((profile) => {
                const active = profile.id === activeId;
                const editing = editingId === profile.id;
                const count = widgetCountFor(profile.id, profile.data);
                return (
                  <li
                    key={profile.id}
                    className={clsx(
                      "group rounded-xl border p-3 transition-colors",
                      active
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:border-primary/30 hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-lg"
                      >
                        {profile.glyph}
                      </span>

                      <div className="min-w-0 flex-1">
                        {editing ? (
                          <input
                            autoFocus
                            value={draftName}
                            onChange={(event) =>
                              setDraftName(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") commitRename(profile.id);
                              if (event.key === "Escape") setEditingId(null);
                            }}
                            onBlur={() => commitRename(profile.id)}
                            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary/60"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">
                              {profile.name}
                            </p>
                            {active && (
                              <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                                <Check className="size-3" />
                                Active
                              </span>
                            )}
                          </div>
                        )}
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {count} widget{count === 1 ? "" : "s"} · updated{" "}
                          {formatRelativeTime(profile.updatedAt)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {!active && !editing && (
                          <button
                            type="button"
                            onClick={() => switchTo(profile.id)}
                            className="btn-surface rounded-lg px-2.5 py-1.5 text-xs font-medium"
                          >
                            Switch
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(profile.id);
                            setDraftName(profile.name);
                          }}
                          aria-label={`Rename ${profile.name}`}
                          title="Rename"
                          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateProfile(profile.id)}
                          aria-label={`Duplicate ${profile.name}`}
                          title="Duplicate"
                          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Copy className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(profile.id)}
                          aria-label={`Delete ${profile.name}`}
                          title="Delete"
                          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!newName.trim()) return;
                createProfile(newName);
                setNewName("");
              }}
              className="flex items-center gap-2"
            >
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="New workspace name…"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
              />
              <button
                type="submit"
                disabled={!newName.trim()}
                className="btn-primary flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="size-4" />
                Create
              </button>
            </form>

            <div>
              <h4 className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                {"// start from a preset"}
              </h4>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {WORKSPACE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      createFromPreset(preset.id);
                      onClose();
                    }}
                    className="flex items-start gap-2.5 rounded-lg border border-border p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
                  >
                    <span aria-hidden className="text-lg leading-none">
                      {preset.glyph}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {preset.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {preset.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Sidebar: analytics + import/export */}
          <aside className="flex flex-col gap-4">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2">
                <Boxes className="size-4 text-primary" />
                <h3 className="text-sm font-medium">Layout analytics</h3>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <Stat label="Active widgets" value={String(activeWidgets.length)} />
                <Stat label="Saved keys" value={String(storedKeys)} />
                <Stat label="Storage" value={storageSize} />
                <Stat
                  label="Last updated"
                  value={
                    profiles.find((profile) => profile.id === activeId)
                      ? formatRelativeTime(
                          profiles.find((profile) => profile.id === activeId)!
                            .updatedAt,
                        )
                      : "just now"
                  }
                />
              </dl>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <HardDrive className="size-3" />
                {activeWidgets.length > 0
                  ? `${activeWidgets.join(", ")}`
                  : "No widgets enabled"}
              </p>
            </div>

            <div className="rounded-xl border border-border p-4">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Download className="size-4 text-muted-foreground" />
                Export workspace
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Download widget states, layout order, theme and snippets as a
                formatted JSON file.
              </p>
              <button
                type="button"
                onClick={exportActive}
                className="btn-surface mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
              >
                <Download className="size-4" />
                Export Workspace (.json)
              </button>
            </div>

            <div className="rounded-xl border border-border p-4">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Upload className="size-4 text-muted-foreground" />
                Import workspace
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Drop a previously exported file to restore the full dashboard
                instantly.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  handleFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  handleFiles(event.dataTransfer.files);
                }}
                className={clsx(
                  "mt-3 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-6 text-center transition-colors",
                  dragOver
                    ? "border-primary/70 bg-primary/5"
                    : "border-border",
                )}
              >
                <Upload className="size-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Drag &amp; drop a .json file here
                </p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-surface rounded-lg px-3 py-1.5 text-xs font-medium"
                >
                  Choose file…
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
              <h3 className="flex items-center gap-2 text-sm font-medium text-rose-500">
                <ShieldAlert className="size-4" />
                Reset layout
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Restore this workspace to its original widget settings.
              </p>
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/40 px-3 py-2 text-sm font-medium text-rose-500 transition-colors hover:bg-rose-500/10"
              >
                <RotateCcw className="size-4" />
                Reset to Default Layout
              </button>
            </div>
          </aside>
        </div>
      </Modal>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset to default layout?"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
            <ShieldAlert className="size-4" />
          </span>
          <p className="text-sm text-muted-foreground">
            Are you sure? This will restore original widget settings for the
            current workspace. Your saved notes, tasks and snippets will be
            cleared.
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmReset(false)}
            className="btn-surface rounded-lg px-3 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              resetActiveLayout();
              setConfirmReset(false);
            }}
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500"
          >
            Reset layout
          </button>
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete workspace?"
      >
        <p className="text-sm text-muted-foreground">
          Delete{" "}
          <span className="font-medium text-foreground">
            {targetProfile?.name}
          </span>
          ? This removes its layout and settings for good.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="btn-surface rounded-lg px-3 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (deleteTarget) deleteProfile(deleteTarget);
              setDeleteTarget(null);
            }}
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500"
          >
            Delete
          </button>
        </div>
      </Modal>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <dt className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-semibold">{value}</dd>
    </div>
  );
}
