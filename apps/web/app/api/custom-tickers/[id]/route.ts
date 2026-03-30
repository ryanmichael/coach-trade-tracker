import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppUser } from "@/lib/auth";

/**
 * PATCH /api/custom-tickers/[id] — Update a custom ticker
 * DELETE /api/custom-tickers/[id] — Remove a custom ticker
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  // Verify ownership
  const existing = await prisma.customTicker.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.customTicker.update({
    where: { id },
    data: {
      direction: body.direction !== undefined ? body.direction : undefined,
      currentPrice: body.currentPrice !== undefined ? body.currentPrice : undefined,
      targetPrice: body.targetPrice !== undefined ? body.targetPrice : undefined,
      projectedDate: body.projectedDate !== undefined
        ? (body.projectedDate ? new Date(body.projectedDate) : null)
        : undefined,
      stopLoss: body.stopLoss !== undefined ? body.stopLoss : undefined,
      riskTolerance: body.riskTolerance !== undefined ? body.riskTolerance : undefined,
    },
  });

  return NextResponse.json({ ticker: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.customTicker.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.customTicker.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
