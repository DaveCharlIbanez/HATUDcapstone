"use client";

import type { ReactNode } from "react";
import { ConvexProvider as ConvexReactProvider, ConvexReactClient } from "convex/react";
import { getConvexUrl } from "./convexConfig";

export const convexClient = new ConvexReactClient(getConvexUrl());

export function ConvexProvider({ children }: { children: ReactNode }) {
  return <ConvexReactProvider client={convexClient}>{children}</ConvexReactProvider>;
}
