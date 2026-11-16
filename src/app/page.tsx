"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppLoader } from "@/components/AppLoader";
import { Landing } from "@/components/landing/Landing";
import { useAuth } from "@/lib/authContext";
import { homeForRole } from "@/lib/roles";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // The landing page belongs to visitors who have not signed in yet. Once
  // there is a session the app belongs to the role's dashboard, and the
  // marketing page is one click away at best.
  useEffect(() => {
    if (user) {
      router.replace(homeForRole(user.role));
    }
  }, [router, user]);

  if (isLoading || user) {
    return <AppLoader variant="full" />;
  }

  return <Landing />;
}
