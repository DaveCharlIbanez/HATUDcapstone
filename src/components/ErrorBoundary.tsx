"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** What to show when the part below it fails. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Keeps one failing part of a screen from taking the whole screen with it.
 *
 * A Convex query that throws does so during render, and with no boundary
 * above it the page is replaced by the framework's error screen. That is
 * exactly the wrong outcome for something decorative — a driver's average
 * rating failing should not stop a passenger from leaving a rating of their
 * own.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("A part of the screen failed to load:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
