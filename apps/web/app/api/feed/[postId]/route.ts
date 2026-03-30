import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ message: "TODO: implement" }, { status: 501 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;

    // Cascade delete in dependency order
    await prisma.$transaction(async (tx) => {
      // 1. Feedback linked to this post or its trades
      await tx.parseFeedback.deleteMany({ where: { coachPostId: postId } });

      // 2. Feed tags
      await tx.feedTag.deleteMany({ where: { coachPostId: postId } });

      // 3. Get parsed trade IDs for this post
      const tradeIds = (
        await tx.parsedTrade.findMany({
          where: { coachPostId: postId },
          select: { id: true },
        })
      ).map((t) => t.id);

      if (tradeIds.length > 0) {
        // 4. Watchlist items linked to these trades
        await tx.watchlistItem.deleteMany({ where: { parsedTradeId: { in: tradeIds } } });
        // 5. Active trades linked to these trades
        await tx.activeTrade.deleteMany({ where: { parsedTradeId: { in: tradeIds } } });
        // 6. The parsed trades themselves
        await tx.parsedTrade.deleteMany({ where: { coachPostId: postId } });
      }

      // 7. Watchlist items linked directly to the post (no parsedTrade)
      await tx.watchlistItem.deleteMany({ where: { coachPostId: postId } });

      // 8. Finally, delete the post
      await tx.coachPost.delete({ where: { id: postId } });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/feed/[postId]]", err);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
