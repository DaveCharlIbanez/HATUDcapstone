"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { IconType } from "react-icons";
import { FaArrowRight, FaChevronDown } from "react-icons/fa";

interface GroupState {
  openId: string | null;
  toggle: (id: string) => void;
}

const GroupContext = createContext<GroupState | null>(null);

/**
 * A list of drop-down sections where only one is open at a time.
 *
 * On a phone a page of open sections is a long scroll. Keeping one open means
 * the page is never longer than the list plus one section. A `#id` in the URL
 * opens that section on load, so other screens can link straight to it.
 */
export function SettingsGroup({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setOpenId(hash);
    }
  }, []);

  const toggle = useCallback((id: string) => {
    setOpenId((current) => (current === id ? null : id));
  }, []);

  const value = useMemo(() => ({ openId, toggle }), [openId, toggle]);

  return (
    <GroupContext.Provider value={value}>
      <div className="space-y-3">{children}</div>
    </GroupContext.Provider>
  );
}

interface SettingsSectionProps {
  children: React.ReactNode;
  icon: IconType;
  /** Unique within the group; also the `#hash` that opens it. */
  id: string;
  /** One line saying what is set now, so most people never need to open it. */
  preview: string;
  title: string;
  tone?: "danger" | "default";
}

const ROW_CLASS =
  "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-strong)]";

function RowLabel({
  icon: Icon,
  preview,
  title,
  tone = "default",
}: {
  icon: IconType;
  preview: string;
  title: string;
  tone?: "danger" | "default";
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
          tone === "danger"
            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
            : "bg-sky-500/15 text-sky-600 dark:text-sky-300"
        }`}
      >
        <Icon />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-[var(--foreground)]">
          {title}
        </span>
        <span className="block truncate text-[var(--text-muted)] text-sm">
          {preview}
        </span>
      </span>
    </span>
  );
}

/**
 * One drop-down: an icon, a title and a one-line preview, opening in place.
 *
 * The panel stays mounted and is hidden with `hidden`, so `aria-controls`
 * always points at something that exists and form input is not lost when
 * the section is closed.
 */
export function SettingsSection({
  children,
  icon,
  id,
  preview,
  title,
  tone,
}: SettingsSectionProps) {
  const group = useContext(GroupContext);
  const [localOpen, setLocalOpen] = useState(false);
  const isOpen = group ? group.openId === id : localOpen;
  const headerRef = useRef<HTMLButtonElement>(null);
  const panelId = `settings-panel-${id}`;

  // On a phone the opened content can land below the fold; bring the header
  // up so the reader sees what they opened.
  useEffect(() => {
    if (isOpen) {
      headerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [isOpen]);

  const onToggle = () => {
    if (group) {
      group.toggle(id);
    } else {
      setLocalOpen((previous) => !previous);
    }
  };

  return (
    <section
      className={`scroll-mt-20 overflow-hidden rounded-2xl border bg-[var(--surface)]/70 transition-colors ${
        isOpen ? "border-sky-500/50" : "border-[var(--border)]"
      }`}
      id={id}
    >
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className={ROW_CLASS}
        onClick={onToggle}
        ref={headerRef}
        type="button"
      >
        <RowLabel icon={icon} preview={preview} title={title} tone={tone} />
        <FaChevronDown
          aria-hidden="true"
          className={`shrink-0 text-[var(--text-muted)] transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className="border-[var(--border)] border-t p-4"
        hidden={!isOpen}
        id={panelId}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * A row in the same list that goes to another screen instead of opening.
 */
export function SettingsLinkRow({
  href,
  icon,
  preview,
  title,
}: {
  href: string;
  icon: IconType;
  preview: string;
  title: string;
}) {
  return (
    <Link
      className={`${ROW_CLASS} rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70`}
      href={href}
    >
      <RowLabel icon={icon} preview={preview} title={title} />
      <FaArrowRight
        aria-hidden="true"
        className="shrink-0 text-[var(--text-muted)]"
      />
    </Link>
  );
}
