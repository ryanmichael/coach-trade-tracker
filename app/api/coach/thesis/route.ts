import { NextRequest, NextResponse } from "next/server";
import { processThesisEntry, processThesisEntryFromPdf, THESIS_TOPICS } from "@repo/agents";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const entries = await prisma.thesisEntry.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(entries);
  } catch (err) {
    console.error("[GET /api/coach/thesis]", err);
    return NextResponse.json({ error: "Failed to fetch thesis entries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { topic, rawText, pdfBase64, filename, postDate } = await req.json();

    if (!topic) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    const validTopics = THESIS_TOPICS.map((t) => t.key);
    if (!validTopics.includes(topic)) {
      return NextResponse.json(
        { error: `Invalid topic. Must be one of: ${validTopics.join(", ")}` },
        { status: 400 }
      );
    }

    const parsedPostDate = postDate ? new Date(postDate) : undefined;

    // Route to PDF processor if pdfBase64 is provided
    if (pdfBase64) {
      if (!filename) {
        return NextResponse.json({ error: "filename is required with pdfBase64" }, { status: 400 });
      }
      const entry = await processThesisEntryFromPdf(prisma, topic, pdfBase64, filename, undefined, parsedPostDate);
      return NextResponse.json(entry, { status: 201 });
    }

    // Text path
    if (!rawText?.trim()) {
      return NextResponse.json({ error: "rawText or pdfBase64 is required" }, { status: 400 });
    }
    const entry = await processThesisEntry(prisma, topic, rawText.trim(), undefined, parsedPostDate);
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error("[POST /api/coach/thesis]", err);
    return NextResponse.json({ error: "Failed to process thesis entry" }, { status: 500 });
  }
}
