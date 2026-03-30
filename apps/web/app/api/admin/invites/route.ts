import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppUser } from "@/lib/auth";

/**
 * GET /api/admin/invites — List all invites
 * POST /api/admin/invites — Create a new invite
 */
export async function GET() {
  const user = await getAppUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await prisma.invite.findMany({
    orderBy: { invitedAt: "desc" },
  });

  return NextResponse.json({ invites });
}

export async function POST(req: NextRequest) {
  const user = await getAppUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if already invited
  const existing = await prisma.invite.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Already invited" },
      { status: 409 }
    );
  }

  const invite = await prisma.invite.create({
    data: {
      email: normalizedEmail,
      invitedBy: user.id,
    },
  });

  return NextResponse.json({ invite }, { status: 201 });
}
