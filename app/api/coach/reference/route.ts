import { NextRequest, NextResponse } from "next/server";
import { processReferenceDocument } from "@/lib/agents";
import { prisma } from "@/lib/db";

// Allow up to 5 minutes for the 4-pass Claude extraction
export const maxDuration = 300;

export async function GET() {
  try {
    const docs = await prisma.referenceDocument.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(docs);
  } catch (err) {
    console.error("[GET /api/coach/reference]", err);
    return NextResponse.json({ error: "Failed to fetch reference documents" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { pdfBase64, filename, title } = await req.json();

    if (!pdfBase64) {
      return NextResponse.json({ error: "pdfBase64 is required" }, { status: 400 });
    }
    if (!filename) {
      return NextResponse.json({ error: "filename is required" }, { status: 400 });
    }

    const result = await processReferenceDocument(prisma, pdfBase64, filename, title);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[POST /api/coach/reference]", err);
    return NextResponse.json({ error: "Failed to process reference document" }, { status: 500 });
  }
}
