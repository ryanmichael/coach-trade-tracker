import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";

export async function PATCH() {
  return NextResponse.json({ message: "TODO: implement" }, { status: 501 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.watchlistItem.deleteMany({
      where: { id, userId: DEFAULT_USER_ID },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/watchlist/[id]]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
