import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppUser } from "@/lib/auth";

/**
 * DELETE /api/admin/invites/[id] — Revoke a pending invite
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAppUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const invite = await prisma.invite.findUnique({ where: { id } });
  if (!invite) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invite.acceptedAt) {
    return NextResponse.json(
      { error: "Cannot revoke an accepted invite" },
      { status: 400 }
    );
  }

  await prisma.invite.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
