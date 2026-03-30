import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/auth/on-login
 * Called after magic link login. Creates User record if first login,
 * marks Invite as accepted.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const email = authUser.email.toLowerCase().trim();

  // Check invite exists
  const invite = await prisma.invite.findUnique({
    where: { email },
  });

  if (!invite) {
    return NextResponse.json({ error: "Not invited" }, { status: 403 });
  }

  // Find or create User record
  let user = await prisma.user.findUnique({
    where: { supabaseAuthId: authUser.id },
  });

  if (!user) {
    // Check if there's an existing User by email (e.g., seeded admin)
    user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Link existing user to Supabase Auth
      user = await prisma.user.update({
        where: { id: user.id },
        data: { supabaseAuthId: authUser.id },
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email,
          supabaseAuthId: authUser.id,
          isAdmin: false,
        },
      });
    }
  }

  // Mark invite as accepted
  if (!invite.acceptedAt) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
    },
  });
}
