"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AppUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

export function useUser() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser?.email) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Call on-login to ensure User record exists and get app user data
      try {
        const res = await fetch("/api/auth/on-login", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch {
        // Fall back to basic info from Supabase
        setUser({ id: authUser.id, email: authUser.email, isAdmin: false });
      }
      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return { user, loading, signOut };
}
