"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  Calculator,
  Check,
  Copy,
  NotebookPen,
  Sparkles,
  Trash2,
} from "lucide-react";

import { useToast } from "@/components/providers/toast-provider";
import { useLocalStorage } from "@/lib/use-local-storage";

const PLACEHOLDER = `Scratch anything here — it saves automatically.

- grep -rn "TODO" src/
- docker compose up -d
- ssh deploy@staging`;

type Tab = "pad" | "calc";

type CalcState = {
  base: number;
  expression: string;
  px: string;
};

const DEFAULT_CALC: CalcState = { base: 16, expression: "", px: "16" };

const PRECEDENCE: Record<string, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "%": 2,
  "^": 3,
};

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
};

type Token =
  | { type: "num"; value: number }
  | { type: "name"; value: string }
  | { type: "op"; value: string }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "comma" };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === " " || char === "\t" || char === "\n") {
      index += 1;
      continue;
    }
    if ((char >= "0" && char <= "9") || char === ".") {
      let end = index;
      while (end < source.length && /[0-9.]/.test(source[end])) end += 1;
      if (source[end] === "e" || source[end] === "E") {
        let cursor = end + 1;
        if (source[cursor] === "+" || source[cursor] === "-") cursor += 1;
        const digitsStart = cursor;
        while (cursor < source.length && /[0-9]/.test(source[cursor])) {
          cursor += 1;
        }
        if (cursor > digitsStart) end = cursor;
      }
      tokens.push({ type: "num", value: Number(source.slice(index, end)) });
      index = end;
      continue;
    }
    if (/[a-zA-Z_]/.test(char)) {
      let end = index;
      while (end < source.length && /[a-zA-Z0-9_]/.test(source[end])) end += 1;
      tokens.push({ type: "name", value: source.slice(index, end) });
      index = end;
      continue;
    }
    if ("+-*/%^".includes(char)) {
      tokens.push({ type: "op", value: char });
      index += 1;
      continue;
    }
    if (char === "(") {
      tokens.push({ type: "lparen" });
      index += 1;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "rparen" });
      index += 1;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "comma" });
      index += 1;
      continue;
    }
    throw new Error(`Unexpected character "${char}"`);
  }
  return tokens;
}

function applyOperator(operator: string, a: number, b: number) {
  switch (operator) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return a / b;
    case "%":
      return a % b;
    case "^":
      return a ** b;
    default:
      throw new Error(`Unknown operator ${operator}`);
  }
}

function evaluateExpression(source: string): number {
  const tokens = tokenize(source);
  let pos = 0;

  function peek() {
    return tokens[pos];
  }

  function parseExpression(minPrecedence: number): number {
    let left = parseUnary();
    for (;;) {
      const token = peek();
      if (!token || token.type !== "op") break;
      const precedence = PRECEDENCE[token.value];
      if (precedence === undefined || precedence < minPrecedence) break;
      pos += 1;
      const rightAssociative = token.value === "^";
      const right = parseExpression(
        rightAssociative ? precedence : precedence + 1,
      );
      left = applyOperator(token.value, left, right);
    }
    return left;
  }

  function parseUnary(): number {
    const token = peek();
    if (token && token.type === "op" && (token.value === "-" || token.value === "+")) {
      pos += 1;
      const value = parseUnary();
      return token.value === "-" ? -value : value;
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const token = tokens[pos];
    pos += 1;
    if (!token) throw new Error("Unexpected end of expression");
    if (token.type === "num") return token.value;
    if (token.type === "lparen") {
      const value = parseExpression(0);
      const close = tokens[pos];
      pos += 1;
      if (!close || close.type !== "rparen") throw new Error("Missing )");
      return value;
    }
    if (token.type === "name") {
      const name = token.value.toLowerCase();
      const next = peek();
      if (next && next.type === "lparen") {
        pos += 1;
        const args: number[] = [];
        if (peek() && peek()!.type !== "rparen") {
          args.push(parseExpression(0));
          while (peek() && peek()!.type === "comma") {
            pos += 1;
            args.push(parseExpression(0));
          }
        }
        const close = tokens[pos];
        pos += 1;
        if (!close || close.type !== "rparen") throw new Error("Missing )");
        const fn = FUNCTIONS[name];
        if (!fn) throw new Error(`Unknown function ${name}`);
        return fn(...args);
      }
      if (name in CONSTANTS) return CONSTANTS[name];
      throw new Error(`Unknown symbol ${name}`);
    }
    throw new Error("Unexpected token");
  }

  const result = parseExpression(0);
  if (pos < tokens.length) throw new Error("Unexpected trailing input");
  return result;
}

function trimNumber(value: number) {
  if (!Number.isFinite(value)) return "";
  return Number(value.toFixed(8)).toString();
}

const KEYPAD = [
  "7",
  "8",
  "9",
  "/",
  "4",
  "5",
  "6",
  "*",
  "1",
  "2",
  "3",
  "-",
  "0",
  ".",
  "(",
  ")",
];

export function ScratchpadWidget() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("pad");
  const [value, setValue] = useLocalStorage<string>("devdesk:scratchpad", "");
  const [calc, setCalc] = useLocalStorage<CalcState>(
    "devdesk:calc",
    DEFAULT_CALC,
  );
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    const source = calc.expression.trim();
    if (!source) return { ok: true as const, display: "" };
    try {
      const value = evaluateExpression(source);
      if (!Number.isFinite(value)) {
        return { ok: false as const, display: "Error" };
      }
      return { ok: true as const, display: trimNumber(value) };
    } catch {
      return { ok: false as const, display: "…" };
    }
  }, [calc.expression]);

  const rem = useMemo(() => {
    const px = Number(calc.px);
    if (!calc.px.trim() || !Number.isFinite(px) || calc.base <= 0) return "";
    return trimNumber(px / calc.base);
  }, [calc.px, calc.base]);

  const lines = value ? value.split("\n").length : 0;

  function clearPad() {
    setValue("");
    toast("Scratchpad cleared", "info");
  }

  function append(token: string) {
    setCalc((current) => ({ ...current, expression: current.expression + token }));
  }

  function backspace() {
    setCalc((current) => ({
      ...current,
      expression: current.expression.slice(0, -1),
    }));
  }

  function clearCalc() {
    setCalc((current) => ({ ...current, expression: "" }));
    toast("Calculator cleared", "info");
  }

  async function copyResult() {
    if (!result.ok || !result.display) return;
    try {
      await navigator.clipboard.writeText(result.display);
      setCopied(true);
      toast(`Copied ${result.display}`, "success");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Clipboard unavailable", "error");
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex rounded-lg border border-border bg-background p-1">
        {(
          [
            { id: "pad" as const, label: "Scratchpad", icon: NotebookPen },
            { id: "calc" as const, label: "Dev Calculator", icon: Calculator },
          ] satisfies { id: Tab; label: string; icon: typeof NotebookPen }[]
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={clsx(
                "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === item.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "pad" ? (
        <div className="animate-fade-in flex flex-1 flex-col gap-2">
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            spellCheck={false}
            placeholder={PLACEHOLDER}
            className="h-48 w-full flex-1 resize-none rounded-lg border border-input bg-background p-3 font-mono text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              {lines} {lines === 1 ? "line" : "lines"} · autosaved
            </span>
            <button
              type="button"
              onClick={clearPad}
              disabled={!value}
              className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-medium transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <Trash2 className="size-3.5" />
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="animate-fade-in flex flex-col gap-3">
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <input
                value={calc.expression}
                onChange={(event) =>
                  setCalc((current) => ({
                    ...current,
                    expression: event.target.value,
                  }))
                }
                spellCheck={false}
                placeholder="e.g. (1440 / 2) + 8^2"
                className="min-w-0 flex-1 bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => void copyResult()}
                disabled={!result.ok || !result.display}
                aria-label="Copy result"
                className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                {copied ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
            <div
              className={clsx(
                "mt-2 truncate border-t border-border pt-2 text-right font-mono text-lg font-semibold tabular-nums",
                result.ok ? "text-foreground" : "text-rose-500",
              )}
            >
              {result.display || "0"}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {KEYPAD.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => append(key)}
                className="rounded-md border border-border bg-background py-2 font-mono text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
              >
                {key}
              </button>
            ))}
            <button
              type="button"
              onClick={() => append("sqrt(")}
              className="rounded-md border border-border bg-background py-2 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
            >
              √
            </button>
            <button
              type="button"
              onClick={() => append("^")}
              className="rounded-md border border-border bg-background py-2 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
            >
              xⁿ
            </button>
            <button
              type="button"
              onClick={() => append("%")}
              className="rounded-md border border-border bg-background py-2 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
            >
              %
            </button>
            <button
              type="button"
              onClick={() => append("+")}
              className="rounded-md border border-border bg-background py-2 font-mono text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
            >
              +
            </button>
            <button
              type="button"
              onClick={backspace}
              className="rounded-md border border-border bg-background py-2 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
            >
              ⌫
            </button>
            <button
              type="button"
              onClick={() => append("pi")}
              className="rounded-md border border-border bg-background py-2 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
            >
              π
            </button>
            <button
              type="button"
              onClick={clearCalc}
              className="col-span-2 rounded-md border border-border bg-background py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Clear
            </button>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                PX → REM
              </span>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                base
                <input
                  type="number"
                  min={1}       
                  value={calc.base}
                  onChange={(event) =>
                    setCalc((current) => ({
                      ...current,
                      base: Number(event.target.value) || 1,
                    }))
                  }
                  className="w-14 rounded border border-input bg-background px-1.5 py-0.5 text-center font-mono text-xs text-foreground outline-none focus:border-primary/60"
                />
                px
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                px
                <input
                  inputMode="decimal"
                  value={calc.px}
                  onChange={(event) =>
                    setCalc((current) => ({
                      ...current,
                      px: event.target.value,
                    }))
                  }
                  placeholder="16"
                  className="rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                rem
                <input
                  inputMode="decimal"
                  value={rem}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setCalc((current) => ({
                      ...current,
                      px:
                        event.target.value === ""
                          ? ""
                          : trimNumber(next * current.base),
                    }));
                  }}
                  placeholder="1"
                  className="rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
