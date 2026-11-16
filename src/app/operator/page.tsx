"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppLoader } from "@/components/AppLoader";

/**
 * The operator map used to live at /operator/map while /operator was a
 * separate copy of the same screen. They have been merged: /operator/map is
 * now the single operator dashboard, and this page forwards to it so that
 * older links, bookmarks and the "Back" buttons still land in the right
 * place.
 */
export default function OperatorRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/operator/map");
  }, [router]);

  return <AppLoader variant="full" />;
}
