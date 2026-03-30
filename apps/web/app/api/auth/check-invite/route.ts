import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/auth/check-invite
 * Validates that an email is invited before sending a magic link.
 */
export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const invite = await prisma.invite.findUnique({
    where: { email: normalizedEmail },
  });

  if (!invite) {
    return NextResponse.json({ invited: false });
  }

  return NextResponse.json({ invited: true });
}
