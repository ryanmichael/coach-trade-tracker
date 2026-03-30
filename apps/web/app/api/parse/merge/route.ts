import { NextRequest, NextResponse } from "next/server";
import { mergeResults } from "@/lib/parser/merge";

export async function POST(req: NextRequest) {
  try {
    const { textResult, imageResults } = await req.json();
    const merged = mergeResults(textResult ?? [], imageResults ?? []);
    return NextResponse.json({ merged });
  } catch {
    return NextResponse.json({ error: "Merge failed" }, { status: 500 });
  }
}
