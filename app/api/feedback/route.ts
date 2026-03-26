import { NextRequest, NextResponse } from "next/server";
import { processFeedback } from "@/lib/agents";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const {
      coachPostId,
      parsedTradeId,
      feedbackText,
      // Structured correction fields — optional, bypass Claude classification
      fieldsCorrected,
      correctedValues,
      correctionType,
    } = await req.json();

    if (!coachPostId || !feedbackText) {
      return NextResponse.json(
        { error: "coachPostId and feedbackText are required" },
        { status: 400 }
      );
    }

    // Save the ParseFeedback record with optional structured fields
    let feedbackId: string | null = null;
    try {
      const feedback = await prisma.parseFeedback.create({
        data: {
          coachPostId,
          parsedTradeId: parsedTradeId ?? null,
          feedbackText,
          // If structured fields are provided, persist them directly
          ...(correctionType ? { correctionType } : {}),
          ...(fieldsCorrected?.length ? { fieldsCorrected } : {}),
          ...(correctedValues ? { correctedValues } : {}),
          // Also store the original values from the parsed trade for context
          ...(parsedTradeId
            ? {
                originalValues: await prisma.parsedTrade
                  .findUnique({ where: { id: parsedTradeId } })
                  .then((t) =>
                    t
                      ? {
                          ticker: t.ticker,
                          direction: t.direction,
                          priceTargetHigh: t.priceTargetHigh,
                          priceTargetLow: t.priceTargetLow,
                          priceConfirmation: t.priceConfirmation,
                          stopLoss: t.stopLoss,
                          supportLevel: t.supportLevel,
                          resistanceLevel: t.resistanceLevel,
                        }
                      : undefined
                  )
                  .catch(() => undefined),
              }
            : {}),
        },
      });
      feedbackId = feedback.id;
    } catch (dbErr) {
      // Post or trade IDs may not exist (e.g., during development with mock data)
      // Log and return success so the UI flow completes
      console.warn("[Feedback] DB save skipped (likely mock data):", dbErr);
      return NextResponse.json({ ok: true, processed: false });
    }

    // Process asynchronously — don't block the response
    if (feedbackId) {
      processFeedback(prisma, feedbackId).catch((err) => {
        console.error(`[Feedback] Async processFeedback failed for ${feedbackId}:`, err);
      });
    }

    return NextResponse.json({ ok: true, id: feedbackId, processed: false });
  } catch (err) {
    console.error("Feedback submit error:", err);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
