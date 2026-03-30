import { NextRequest, NextResponse } from "next/server";
import { parseText } from "@/lib/parser/text-parser";

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();
    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    const start = Date.now();
    const trades = parseText(content.trim());
    const processingTimeMs = Date.now() - start;

    return NextResponse.json({
      trades,
      rawText: content,
      processingTimeMs,
    });
  } catch {
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
  }
}
