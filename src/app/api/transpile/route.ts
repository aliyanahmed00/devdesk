import { NextResponse } from "next/server";

type TranspileBody = {
  code?: unknown;
};

export async function POST(request: Request) {
  let body: TranspileBody;
  try {
    body = (await request.json()) as TranspileBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  if (!code.trim()) {
    return NextResponse.json({ code: "" });
  }

  try {
    const imported = await import("typescript");
    const ts = (
      "default" in imported && imported.default ? imported.default : imported
    ) as typeof import("typescript");

    const output = ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        isolatedModules: true,
        removeComments: false,
      },
      reportDiagnostics: false,
    });

    return NextResponse.json({ code: output.outputText });
  } catch {
    return NextResponse.json(
      { error: "TypeScript transpilation is unavailable." },
      { status: 500 },
    );
  }
}
