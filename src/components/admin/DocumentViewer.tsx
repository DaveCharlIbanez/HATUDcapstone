"use client";

import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { FaBan, FaTimes } from "react-icons/fa";
import { useAuth } from "@/lib/authContext";
import type { DocumentKind } from "@/lib/documentImage";
import { api } from "../../../convex/_generated/api";
import type { AdminDriverRow } from "../../../convex/adminQueries";

const DOCUMENT_LABELS: Record<string, string> = {
  insurance: "Insurance",
  license: "Driver's License",
  officialReceipt: "LTO Official Receipt",
  registration: "Certificate of Registration",
};

const DOCUMENT_ORDER: DocumentKind[] = [
  "license",
  "registration",
  "officialReceipt",
  "insurance",
];

interface DocumentViewerProps {
  driver: AdminDriverRow;
  isOpen: boolean;
  onApprove: (driver: AdminDriverRow, note?: string) => void;
  onClose: () => void;
  onReject: (driver: AdminDriverRow, note: string) => void;
}

/**
 * The admin's view of one applicant's four credential documents.
 *
 * Every document is shown in full, not as a filename, so the decision is
 * made on evidence. A rejection asks for a note, which the driver sees.
 */
export function DocumentViewer({
  driver,
  isOpen,
  onApprove,
  onClose,
  onReject,
}: DocumentViewerProps) {
  const { sessionToken } = useAuth();
  const [isRejecting, setIsRejecting] = useState(false);
  const [note, setNote] = useState("");

  const documents = useQuery(
    api.documents.listForOperator,
    isOpen && sessionToken ? { sessionToken, operatorId: driver._id } : "skip"
  );

  useEffect(() => {
    if (!isOpen) {
      setIsRejecting(false);
      setNote("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const byKind = new Map(
    (documents?.documents ?? []).map((document) => [document.kind, document])
  );

  return (
    <div
      aria-label={`Documents uploaded by ${driver.name}`}
      aria-modal="true"
      className="fixed inset-0 z-[100] flex flex-col bg-[var(--background)]"
      role="dialog"
    >
      <header className="flex items-start justify-between gap-3 border-[var(--border)] border-b bg-[var(--surface)] p-4">
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-[var(--foreground)] text-lg">
            {driver.name}
          </h2>
          <p className="mt-0.5 text-[var(--text-muted)] text-sm">
            {driver.vehicleInfo.model} • {driver.vehicleInfo.plateNumber} •{" "}
            {driver.licenseNumber}
          </p>
        </div>
        <button
          aria-label="Close"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
          onClick={onClose}
          type="button"
        >
          <FaTimes className="text-lg" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {documents === undefined ? (
          <p className="py-10 text-center text-[var(--text-muted)]">
            Loading the documents...
          </p>
        ) : (
          <div className="mx-auto max-w-2xl space-y-6">
            {DOCUMENT_ORDER.map((kind) => {
              const document = byKind.get(kind);
              return (
                <section key={kind}>
                  <h3 className="mb-2 font-semibold text-[var(--foreground)] text-sm">
                    {DOCUMENT_LABELS[kind]}
                  </h3>
                  {document?.url ? (
                    // A signed storage URL on a different host, so the image
                    // is rendered unoptimized.
                    // biome-ignore lint/performance/noImgElement: signed storage URL
                    <img
                      alt={`${DOCUMENT_LABELS[kind]} uploaded by ${driver.name}`}
                      className="h-auto w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] object-contain"
                      height={1200}
                      src={document.url}
                      width={1600}
                    />
                  ) : (
                    <div className="rounded-2xl border border-[var(--border)] border-dashed bg-[var(--surface-strong)] p-6 text-center text-[var(--text-muted)] text-sm">
                      Not uploaded
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <footer className="border-[var(--border)] border-t bg-[var(--surface)] p-4">
        <div className="mx-auto max-w-2xl">
          {isRejecting ? (
            <div className="space-y-3">
              <label
                className="block font-semibold text-[var(--foreground)] text-sm"
                htmlFor="rejection-note"
              >
                What needs to be fixed?
              </label>
              <textarea
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/50 px-4 py-3 text-[var(--foreground)] text-sm placeholder:text-[var(--text-muted)] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                id="rejection-note"
                onChange={(event) => setNote(event.target.value)}
                placeholder="The driver sees this note"
                rows={3}
                value={note}
              />
              <div className="flex gap-3">
                <button
                  className="flex-1 rounded-full border border-[var(--border)] py-3 font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-strong)]"
                  onClick={() => setIsRejecting(false)}
                  type="button"
                >
                  Back
                </button>
                <button
                  className="flex-1 rounded-full bg-rose-600 py-3 font-semibold text-sm text-white transition hover:bg-rose-500"
                  onClick={() => onReject(driver, note)}
                  type="button"
                >
                  Reject application
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-full border border-rose-500/30 bg-rose-500/10 py-3 font-semibold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                onClick={() => setIsRejecting(true)}
                type="button"
              >
                <FaBan className="mr-1" />
                Reject
              </button>
              <button
                className="flex-1 rounded-full bg-emerald-600 py-3 font-semibold text-sm text-white transition hover:bg-emerald-500"
                onClick={() => onApprove(driver)}
                type="button"
              >
                Approve driver
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
