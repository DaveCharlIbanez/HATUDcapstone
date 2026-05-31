"use client";

import {
  ConvexReactClient,
  ConvexProvider as ConvexReactProvider,
} from "convex/react";
import type { ReactNode } from "react";
import { getConvexUrl } from "./convexConfig";

export const convexClient = new ConvexReactClient(getConvexUrl());

export function ConvexProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexReactProvider client={convexClient}>{children}</ConvexReactProvider>
  );
}
