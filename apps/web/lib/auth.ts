import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";

export interface AppUser {
  id: string;
  email: string;
  isAdmin: boolean;
  supabaseAuthId: string;
}

/**
 * Get the authenticated app user from the current request.
 * Returns null if not authenticated or user not found in DB.
 */
export async function getAppUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) return null;

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: authUser.id },
    select: { id: true, email: true, isAdmin: true, supabaseAuthId: true },
  });

  if (!dbUser || !dbUser.supabaseAuthId) return null;

  return {
    id: dbUser.id,
    email: dbUser.email,
    isAdmin: dbUser.isAdmin,
    supabaseAuthId: dbUser.supabaseAuthId,
  };
}

/**
 * Require an authenticated user, or throw.
 */
export async function requireUser(): Promise<AppUser> {
  const user = await getAppUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

/**
 * Require an admin user, or throw.
 */
export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("Forbidden");
  return user;
}
