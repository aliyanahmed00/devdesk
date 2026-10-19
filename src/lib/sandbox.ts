"use client";

export type SandboxLogLevel = "log" | "info" | "warn" | "error";

export type SandboxLog = {
  level: SandboxLogLevel;
  text: string;
};

export type SandboxResult = {
  logs: SandboxLog[];
  result?: string;
  hasResult?: boolean;
  error?: string;
  durationMs: number;
  timedOut: boolean;
};

type WorkerMessage =
  | { type: "log"; level: SandboxLogLevel; text: string }
  | { type: "done"; result: string; hasResult: boolean }
  | { type: "error"; text: string };

const WORKER_SOURCE = [
  'self.onmessage = function (event) {',
  '  var code = event.data && event.data.code;',
  '  function stringify(value) {',
  '    try {',
  '      if (value === undefined) return "undefined";',
  '      if (value === null) return "null";',
  '      if (typeof value === "string") return value;',
  '      if (typeof value === "function") return value.toString();',
  '      if (typeof value === "bigint") return value.toString() + "n";',
  '      if (typeof value === "symbol") return value.toString();',
  '      if (typeof value !== "object") return String(value);',
  '      var seen = new WeakSet();',
  '      return JSON.stringify(value, function (key, val) {',
  '        if (typeof val === "object" && val !== null) {',
  '          if (seen.has(val)) return "[Circular]";',
  '          seen.add(val);',
  '        }',
  '        if (typeof val === "function") return "[Function " + (val.name || "anonymous") + "]";',
  '        if (typeof val === "bigint") return val.toString() + "n";',
  '        return val;',
  '      }, 2);',
  '    } catch (err) {',
  '      try { return String(value); } catch (inner) { return "[unserializable]"; }',
  '    }',
  '  }',
  '  function emit(level) {',
  '    return function () {',
  '      var parts = [];',
  '      for (var i = 0; i < arguments.length; i += 1) parts.push(stringify(arguments[i]));',
  '      self.postMessage({ type: "log", level: level, text: parts.join(" ") });',
  '    };',
  '  }',
  '  var sandboxConsole = {',
  '    log: emit("log"), info: emit("info"), debug: emit("log"),',
  '    warn: emit("warn"), error: emit("error"), trace: emit("log"),',
  '    table: emit("log"), dir: emit("log"),',
  '  };',
  '  try {',
  '    var result = (function (console) { return eval(code); })(sandboxConsole);',
  '    self.postMessage({ type: "done", result: stringify(result), hasResult: result !== undefined });',
  '  } catch (err) {',
  '    self.postMessage({ type: "error", text: err && err.stack ? String(err.stack) : String(err) });',
  '  }',
  '};',
].join("\n");

export type RunOptions = {
  timeoutMs?: number;
  onLog?: (log: SandboxLog) => void;
};

export function runJavaScript(
  code: string,
  { timeoutMs = 4000, onLog }: RunOptions = {},
): Promise<SandboxResult> {
  return new Promise<SandboxResult>((resolve) => {
    const startedAt =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const logs: SandboxLog[] = [];
    let settled = false;
    let objectUrl = "";
    let worker: Worker | null = null;
    let timer = 0;

    const finish = (
      payload: Partial<Pick<SandboxResult, "result" | "hasResult" | "error" | "timedOut">>,
    ) => {
      if (settled) return;
      settled = true;
      if (timer) window.clearTimeout(timer);
      worker?.terminate();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const finishedAt =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      resolve({
        logs,
        durationMs: Math.max(0, Math.round(finishedAt - startedAt)),
        timedOut: payload.timedOut ?? false,
        result: payload.result,
        hasResult: payload.hasResult,
        error: payload.error,
      });
    };

    try {
      objectUrl = URL.createObjectURL(
        new Blob([WORKER_SOURCE], { type: "application/javascript" }),
      );
      worker = new Worker(objectUrl);
    } catch {
      resolve({
        logs,
        durationMs: 0,
        timedOut: false,
        error: "Sandbox is unavailable in this environment.",
      });
      return;
    }

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "log") {
        const log: SandboxLog = { level: message.level, text: message.text };
        logs.push(log);
        onLog?.(log);
      } else if (message.type === "done") {
        finish({ result: message.result, hasResult: message.hasResult });
      } else if (message.type === "error") {
        finish({ error: message.text });
      }
    };

    worker.onerror = (event) => {
      finish({ error: event.message || "Sandbox worker crashed." });
    };

    timer = window.setTimeout(() => {
      finish({
        error: `Execution timed out after ${timeoutMs}ms (possible infinite loop).`,
        timedOut: true,
      });
    }, timeoutMs);

    worker.postMessage({ code });
  });
}
