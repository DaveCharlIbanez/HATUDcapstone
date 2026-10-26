"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import {
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaPaperPlane,
} from "react-icons/fa";
import { DocumentUploader } from "@/components/documents/DocumentUploader";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/authContext";
import { api } from "../../../../convex/_generated/api";

type Status = "approved" | "pending" | "rejected";

const STATUS_COPY: Record<Status, { blurb: string; title: string }> = {
  approved: {
    blurb:
      "Your application was approved. You can go online and start taking rides.",
    title: "You are approved",
  },
  pending: {
    blurb:
      "An administrator is reviewing your credentials. We will let you know once your application is approved.",
    title: "Application under review",
  },
  rejected: {
    blurb:
      "Your application was not approved. Fix the problem below and send it again.",
    title: "Application not approved",
  },
};

export default function OperatorApplicationPage() {
  const { sessionToken, user } = useAuth();
  const { showToast } = useToast();
  const [isResubmitting, setIsResubmitting] = useState(false);

  const profile = useQuery(
    api.operators.getSelf,
    sessionToken ? { sessionToken } : "skip"
  );
  const documents = useQuery(
    api.documents.listMyDocuments,
    sessionToken ? { sessionToken } : "skip"
  );
  const resubmit = useMutation(api.documents.resubmitApplication);
  const status: Status = profile?.approvalStatus ?? "pending";
  const copy = STATUS_COPY[status];
  const isRejected = status === "rejected";
  const isApproved = status === "approved";
  const isComplete = documents !== undefined && documents.missing.length === 0;

  const statusIcon = (() => {
    if (isApproved) {
      return <FaCheckCircle className="text-emerald-500" />;
    }
    if (isRejected) {
      return <FaExclamationTriangle className="text-rose-500" />;
    }
    return <FaClock className="text-amber-500" />;
  })();

  const handleResubmit = async () => {
    if (!sessionToken) {
      return;
    }
    setIsResubmitting(true);
    try {
      await resubmit({ sessionToken });
      showToast("Your application is back in the review queue.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not resubmit.",
        "error"
      );
    } finally {
      setIsResubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <p className="text-sky-500 text-sm uppercase tracking-[0.2em] dark:text-sky-400">
            Driver application
          </p>
          <h1 className="mt-2 font-semibold text-3xl text-[var(--foreground)]">
            {copy.title}
          </h1>
          <p className="mt-2 text-[var(--text-muted)] text-sm">{copy.blurb}</p>

          <div className="mt-4 flex items-center gap-2 text-[var(--text-muted)] text-sm">
            {statusIcon}
            <span>
              {user?.name} • {user?.email}
            </span>
          </div>
        </header>

        {profile?.rejectionNote ? (
          <section className="mt-4 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-5">
            <h2 className="font-semibold text-rose-600 text-sm dark:text-rose-400">
              What the administrator said
            </h2>
            <p className="mt-2 text-[var(--foreground)] text-sm">
              {profile.rejectionNote}
            </p>
          </section>
        ) : null}

        <section className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="font-semibold text-[var(--foreground)]">
            Your credentials
          </h2>
          <p className="mt-1 mb-4 text-[var(--text-muted)] text-sm">
            {isApproved
              ? "These are the documents on file for your account."
              : "All four documents are needed before an application can be reviewed."}
          </p>

          <DocumentUploader onUploaded={() => undefined} />
        </section>

        {isRejected ? (
          <section className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
            <h2 className="font-semibold text-[var(--foreground)]">
              Send it again
            </h2>
            <p className="mt-1 mb-4 text-[var(--text-muted)] text-sm">
              {isComplete
                ? "All four documents are in place. Send your application back for another look."
                : "Upload the missing documents above first."}
            </p>
            <button
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-sky-600 px-5 py-3 font-semibold text-sm text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!isComplete || isResubmitting}
              onClick={handleResubmit}
              type="button"
            >
              <FaPaperPlane />
              {isResubmitting ? "Sending..." : "Resubmit for review"}
            </button>
          </section>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            className="rounded-full border border-[var(--border)] px-5 py-2.5 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-strong)]"
            href="/operator/profile"
          >
            View my profile
          </Link>
          {isApproved ? (
            <Link
              className="rounded-full bg-sky-600 px-5 py-2.5 font-semibold text-sm text-white transition hover:bg-sky-500"
              href="/operator/map"
            >
              Go to dashboard
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
