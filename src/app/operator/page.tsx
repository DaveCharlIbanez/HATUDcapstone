"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FaSpinner } from "react-icons/fa";

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <FaSpinner className="animate-spin text-2xl text-sky-400" />
    </div>
  );
}
