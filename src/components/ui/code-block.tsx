"use client";

import { useMemo } from "react";
import { clsx } from "clsx";

type TokenType =
  | "plain"
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "literal"
  | "function"
  | "type"
  | "property"
  | "operator"
  | "punctuation"
  | "tag";

type Token = { type: TokenType; value: string };

type Dialect =
  | "ts"
  | "js"
  | "py"
  | "sql"
  | "bash"
  | "css"
  | "json"
  | "text";

type TokenConfig = {
  dialect: Dialect;
  keywords: Set<string>;
  literals: Set<string>;
  types: Set<string>;
  lineComments: string[];
  blockComment?: [string, string];
  strings: string[];
  caseSensitive: boolean;
  dollarVars: boolean;
};

const TOKEN_CLASS: Record<TokenType, string> = {
  plain: "text-zinc-200",
  comment: "text-zinc-500 italic",
  string: "text-emerald-400",
  number: "text-amber-300",
  keyword: "text-violet-400",
  literal: "text-orange-300",
  function: "text-sky-300",
  type: "text-cyan-300",
  property: "text-indigo-300",
  operator: "text-rose-400",
  punctuation: "text-zinc-500",
  tag: "text-rose-400",
};

const JS_KEYWORDS = [
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "default",
  "break",
  "continue",
  "new",
  "delete",
  "typeof",
  "instanceof",
  "in",
  "of",
  "this",
  "super",
  "class",
  "extends",
  "import",
  "export",
  "from",
  "as",
  "async",
  "await",
  "try",
  "catch",
  "finally",
  "throw",
  "yield",
  "void",
  "static",
  "get",
  "set",
  "with",
  "debugger",
];

const JS_LITERALS = ["true", "false", "null", "undefined", "NaN", "Infinity"];

const TS_TYPES = [
  "interface",
  "type",
  "enum",
  "namespace",
  "declare",
  "abstract",
  "implements",
  "public",
  "private",
  "protected",
  "readonly",
  "keyof",
  "infer",
  "is",
  "asserts",
  "satisfies",
  "override",
  "any",
  "string",
  "number",
  "boolean",
  "void",
  "never",
  "unknown",
  "object",
  "symbol",
  "bigint",
];

const PY_KEYWORDS = [
  "def",
  "return",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "import",
  "from",
  "as",
  "class",
  "try",
  "except",
  "finally",
  "with",
  "lambda",
  "yield",
  "global",
  "nonlocal",
  "pass",
  "break",
  "continue",
  "and",
  "or",
  "not",
  "in",
  "is",
  "async",
  "await",
  "del",
  "raise",
  "assert",
];

const PY_TYPES = ["int", "str", "float", "bool", "list", "dict", "set", "tuple", "object"];

const SQL_KEYWORDS = [
  "select",
  "from",
  "where",
  "insert",
  "into",
  "values",
  "update",
  "set",
  "delete",
  "create",
  "table",
  "alter",
  "drop",
  "join",
  "left",
  "right",
  "inner",
  "outer",
  "full",
  "on",
  "group",
  "by",
  "order",
  "having",
  "limit",
  "offset",
  "as",
  "and",
  "or",
  "not",
  "null",
  "is",
  "in",
  "like",
  "between",
  "distinct",
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "case",
  "when",
  "then",
  "else",
  "end",
  "union",
  "all",
  "asc",
  "desc",
  "primary",
  "key",
  "foreign",
  "references",
  "index",
  "with",
  "returning",
  "using",
  "cast",
];

const BASH_KEYWORDS = [
  "if",
  "then",
  "else",
  "elif",
  "fi",
  "for",
  "while",
  "do",
  "done",
  "case",
  "esac",
  "function",
  "in",
  "return",
  "export",
  "local",
  "source",
  "echo",
  "cd",
  "sudo",
  "rm",
  "cp",
  "mv",
  "mkdir",
  "chmod",
  "chown",
  "grep",
  "xargs",
  "awk",
  "sed",
  "cat",
  "touch",
  "curl",
  "git",
  "npm",
  "pnpm",
  "yarn",
  "docker",
];

function toSet(words: string[]): Set<string> {
  return new Set(words);
}

function makeConfig(dialect: Dialect): TokenConfig {
  switch (dialect) {
    case "ts":
      return {
        dialect,
        keywords: toSet(JS_KEYWORDS),
        literals: toSet(JS_LITERALS),
        types: toSet(TS_TYPES),
        lineComments: ["//"],
        blockComment: ["/*", "*/"],
        strings: ['"', "'", "`"],
        caseSensitive: true,
        dollarVars: false,
      };
    case "js":
      return {
        dialect,
        keywords: toSet(JS_KEYWORDS),
        literals: toSet(JS_LITERALS),
        types: toSet([]),
        lineComments: ["//"],
        blockComment: ["/*", "*/"],
        strings: ['"', "'", "`"],
        caseSensitive: true,
        dollarVars: false,
      };
    case "py":
      return {
        dialect,
        keywords: toSet(PY_KEYWORDS),
        literals: toSet(["True", "False", "None"]),
        types: toSet(PY_TYPES),
        lineComments: ["#"],
        strings: ['"', "'"],
        caseSensitive: true,
        dollarVars: false,
      };
    case "sql":
      return {
        dialect,
        keywords: toSet(SQL_KEYWORDS),
        literals: toSet(["true", "false", "null"]),
        types: toSet([]),
        lineComments: ["--"],
        blockComment: ["/*", "*/"],
        strings: ["'", '"'],
        caseSensitive: false,
        dollarVars: false,
      };
    case "bash":
      return {
        dialect,
        keywords: toSet(BASH_KEYWORDS),
        literals: toSet(["true", "false"]),
        types: toSet([]),
        lineComments: ["#"],
        strings: ['"', "'"],
        caseSensitive: true,
        dollarVars: true,
      };
    case "css":
      return {
        dialect,
        keywords: toSet([]),
        literals: toSet([]),
        types: toSet([]),
        lineComments: [],
        blockComment: ["/*", "*/"],
        strings: ['"', "'"],
        caseSensitive: true,
        dollarVars: false,
      };
    case "json":
      return {
        dialect,
        keywords: toSet([]),
        literals: toSet(["true", "false", "null"]),
        types: toSet([]),
        lineComments: [],
        strings: ['"'],
        caseSensitive: true,
        dollarVars: false,
      };
    default:
      return {
        dialect: "text",
        keywords: toSet([]),
        literals: toSet([]),
        types: toSet([]),
        lineComments: ["//"],
        blockComment: ["/*", "*/"],
        strings: ['"', "'"],
        caseSensitive: true,
        dollarVars: false,
      };
  }
}

function resolveDialect(language: string): Dialect {
  const key = language.trim().toLowerCase();
  if (["ts", "typescript", "tsx"].includes(key)) return "ts";
  if (["js", "javascript", "jsx", "mjs", "cjs", "node"].includes(key)) return "js";
  if (["py", "python", "python3"].includes(key)) return "py";
  if (["sql", "postgres", "postgresql", "mysql", "sqlite"].includes(key)) return "sql";
  if (["sh", "bash", "shell", "zsh", "console", "shell scripting"].includes(key)) return "bash";
  if (["css", "scss", "less", "sass"].includes(key)) return "css";
  if (["json", "jsonc"].includes(key)) return "json";
  return "text";
}

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_$]/.test(ch);
}

function isIdentPart(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch);
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function tokenize(code: string, config: TokenConfig): Token[] {
  const tokens: Token[] = [];
  const length = code.length;
  let i = 0;
  let buffer = "";

  const flush = () => {
    if (buffer) {
      tokens.push({ type: "plain", value: buffer });
      buffer = "";
    }
  };

  const skipString = (start: number, quote: string): number => {
    let j = start + 1;
    while (j < length) {
      const ch = code[j];
      if (ch === "\\") {
        j += 2;
        continue;
      }
      if (quote !== "`" && ch === "\n") break;
      if (ch === quote) {
        j += 1;
        break;
      }
      j += 1;
    }
    return j;
  };

  while (i < length) {
    if (config.blockComment && code.startsWith(config.blockComment[0], i)) {
      flush();
      const close = code.indexOf(
        config.blockComment[1],
        i + config.blockComment[0].length,
      );
      const stop =
        close === -1 ? length : close + config.blockComment[1].length;
      tokens.push({ type: "comment", value: code.slice(i, stop) });
      i = stop;
      continue;
    }

    const lineComment = config.lineComments.find((marker) =>
      code.startsWith(marker, i),
    );
    if (lineComment) {
      flush();
      const end = code.indexOf("\n", i);
      const stop = end === -1 ? length : end;
      tokens.push({ type: "comment", value: code.slice(i, stop) });
      i = stop;
      continue;
    }

    const ch = code[i];

    if (config.strings.includes(ch)) {
      flush();
      const stop = skipString(i, ch);
      let type: TokenType = "string";
      if (config.dialect === "json") {
        let k = stop;
        while (k < length && (code[k] === " " || code[k] === "\t")) k += 1;
        if (code[k] === ":") type = "property";
      }
      tokens.push({ type, value: code.slice(i, stop) });
      i = stop;
      continue;
    }

    if (config.dollarVars && ch === "$") {
      flush();
      let j = i + 1;
      if (code[j] === "{") {
        j += 1;
        while (j < length && code[j] !== "}") j += 1;
        if (code[j] === "}") j += 1;
      } else {
        while (j < length && isIdentPart(code[j])) j += 1;
      }
      tokens.push({ type: "type", value: code.slice(i, j) });
      i = j;
      continue;
    }

    if (isDigit(ch) || (ch === "." && isDigit(code[i + 1] ?? ""))) {
      flush();
      let j = i;
      if (ch === "0" && /[xXoObB]/.test(code[i + 1] ?? "")) {
        j = i + 2;
        while (j < length && /[0-9a-fA-F_]/.test(code[j])) j += 1;
      } else {
        while (j < length && /[0-9_]/.test(code[j])) j += 1;
        if (code[j] === ".") {
          j += 1;
          while (j < length && /[0-9_]/.test(code[j])) j += 1;
        }
        if (code[j] === "e" || code[j] === "E") {
          let k = j + 1;
          if (code[k] === "+" || code[k] === "-") k += 1;
          if (isDigit(code[k] ?? "")) {
            j = k;
            while (j < length && /[0-9_]/.test(code[j])) j += 1;
          }
        }
      }
      tokens.push({ type: "number", value: code.slice(i, j) });
      i = j;
      continue;
    }

    if (isIdentStart(ch)) {
      flush();
      let j = i + 1;
      while (j < length && isIdentPart(code[j])) j += 1;
      const word = code.slice(i, j);
      const lookup = config.caseSensitive ? word : word.toLowerCase();
      let type: TokenType = "plain";
      if (config.literals.has(lookup)) type = "literal";
      else if (config.keywords.has(lookup)) type = "keyword";
      else if (config.types.has(lookup)) type = "type";
      else {
        let k = j;
        while (k < length && (code[k] === " " || code[k] === "\t")) k += 1;
        if (code[k] === "(") type = "function";
        else if (config.dialect === "css") {
          if (code[k] === ":") type = "property";
        }
      }
      tokens.push({ type, value: word });
      i = j;
      continue;
    }

    if (config.dialect === "css" && ch === "@") {
      flush();
      let j = i + 1;
      while (j < length && (isIdentPart(code[j]) || code[j] === "-")) j += 1;
      tokens.push({ type: "keyword", value: code.slice(i, j) });
      i = j;
      continue;
    }

    if (config.dialect === "css" && ch === "#") {
      flush();
      let j = i + 1;
      while (j < length && /[0-9a-fA-F]/.test(code[j])) j += 1;
      const isHex =
        j > i + 1 &&
        (j - i === 4 || j - i === 5 || j - i === 7 || j - i === 9);
      if (isHex) {
        tokens.push({ type: "number", value: code.slice(i, j) });
        i = j;
        continue;
      }
      while (j < length && (isIdentPart(code[j]) || code[j] === "-")) j += 1;
      tokens.push({ type: "tag", value: code.slice(i, j) });
      i = j;
      continue;
    }

    if (/[+\-*/%=<>!&|^~?]/.test(ch)) {
      flush();
      tokens.push({ type: "operator", value: ch });
      i += 1;
      continue;
    }

    if (/[{}()[\];,.:]/.test(ch)) {
      flush();
      tokens.push({ type: "punctuation", value: ch });
      i += 1;
      continue;
    }

    buffer += ch;
    i += 1;
  }

  flush();
  return tokens;
}

function tokensToLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]];
  for (const token of tokens) {
    const parts = token.value.split("\n");
    for (let index = 0; index < parts.length; index += 1) {
      if (index > 0) lines.push([]);
      if (parts[index]) {
        lines[lines.length - 1].push({
          type: token.type,
          value: parts[index],
        });
      }
    }
  }
  return lines;
}

export function CodeBlock({
  code,
  language,
  className,
}: {
  code: string;
  language: string;
  className?: string;
}) {
  const lines = useMemo(() => {
    const config = makeConfig(resolveDialect(language));
    return tokensToLines(tokenize(code, config));
  }, [code, language]);

  return (
    <pre
      className={clsx(
        "scrollbar-thin overflow-auto rounded-lg border border-zinc-800/80 bg-[#0b0c10] py-3 font-mono text-[11.5px] leading-5",
        className,
      )}
    >
      <code className="block min-w-full">
        {lines.map((line, index) => (
          <div key={index} className="flex min-w-full w-max">
            <span
              aria-hidden
              className="sticky left-0 z-10 w-9 shrink-0 select-none border-r border-white/5 bg-[#0b0c10] pr-2 text-right text-zinc-600"
            >
              {index + 1}
            </span>
            <span className="pl-3 pr-4 whitespace-pre">
              {line.length === 0
                ? " "
                : line.map((token, tokenIndex) => (
                    <span key={tokenIndex} className={TOKEN_CLASS[token.type]}>
                      {token.value}
                    </span>
                  ))}
            </span>
          </div>
        ))}
      </code>
    </pre>
  );
}
