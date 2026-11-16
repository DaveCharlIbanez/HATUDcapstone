import type { ReactNode } from "react";
import {
  SiAndroid,
  SiBiome,
  SiCapacitor,
  SiMaplibre,
  SiNextdotjs,
  SiOpenstreetmap,
  SiReact,
  SiTailwindcss,
  SiTypescript,
  SiVitest,
} from "react-icons/si";
import { ConvexMark } from "./ConvexMark";

interface Tech {
  category: string;
  icon: ReactNode;
  name: string;
}

const ICON = "h-6 w-6";

/**
 * What HATUD is built with. Only what the app really runs on is listed —
 * the old `flask_api/` folder is not used by the app, so it is left out.
 */
const STACK: Tech[] = [
  {
    category: "Framework",
    icon: <SiNextdotjs className={ICON} />,
    name: "Next.js",
  },
  { category: "UI library", icon: <SiReact className={ICON} />, name: "React" },
  {
    category: "Language",
    icon: <SiTypescript className={ICON} />,
    name: "TypeScript",
  },
  {
    category: "Styling",
    icon: <SiTailwindcss className={ICON} />,
    name: "Tailwind CSS",
  },
  {
    category: "Database & backend",
    icon: <ConvexMark className={ICON} />,
    name: "Convex",
  },
  { category: "Maps", icon: <SiMaplibre className={ICON} />, name: "MapLibre" },
  {
    category: "Map data · OSRM routing",
    icon: <SiOpenstreetmap className={ICON} />,
    name: "OpenStreetMap",
  },
  {
    category: "Mobile",
    icon: <SiCapacitor className={ICON} />,
    name: "Capacitor",
  },
  {
    category: "Platform",
    icon: <SiAndroid className={ICON} />,
    name: "Android",
  },
  {
    category: "Payments",
    icon: (
      <span className="rounded-md bg-[var(--surface-muted)] px-1 font-black text-[0.6rem] leading-6 tracking-tight">
        PM
      </span>
    ),
    name: "PayMongo",
  },
  { category: "Testing", icon: <SiVitest className={ICON} />, name: "Vitest" },
  {
    category: "Code quality",
    icon: <SiBiome className={ICON} />,
    name: "Biome",
  },
];

/**
 * The tech HATUD is built on, as a grid of tiles.
 *
 * `startIndex` carries on the stagger from the content above, so the tiles
 * ease in after it, one after another.
 */
export function TechStack({ startIndex }: { startIndex: number }) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {STACK.map((tech, index) => (
        <li
          className="landing-reveal flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-3 backdrop-blur"
          key={tech.name}
          style={{ "--i": startIndex + index } as React.CSSProperties}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-strong)] text-[var(--foreground)]">
            {tech.icon}
          </span>
          <span className="min-w-0">
            <span className="block break-words font-semibold text-[var(--foreground)] text-sm leading-tight">
              {tech.name}
            </span>
            <span className="mt-0.5 block text-[var(--text-muted)] text-xs leading-tight">
              {tech.category}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
