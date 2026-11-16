export const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";

export function getConvexUrl(): string {
  if (!convexUrl) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL is not set. Add it to .env.local or run `npx convex dev`."
    );
  }
  return convexUrl;
}

export interface ConvexUser {
  createdAt: string;
  email: string;
  id: string;
  lastLoginAt?: string;
  name: string;
  phone: string;
  role: "commuter" | "operator" | "admin";
}

export interface ConvexAuthSession {
  expiresAt: string;
  issuedAt: string;
  token: string;
  userId: string;
}

export interface ConvexOperatorProfile {
  earnings: number;
  email: string;
  id: string;
  name: string;
  phone: string;
  plate: string;
  rating: number;
  region: string;
  ridesToday: number;
  vehicle: string;
}

export interface ConvexCommuterProfile {
  avatar?: string;
  email: string;
  id: string;
  joinDate: string;
  name: string;
  phone: string;
  rating: number;
  totalRides: number;
  totalSpent: number;
}

export interface ConvexRide {
  commuterId: string;
  cost: number;
  createdAt: string;
  from: string;
  id: string;
  operatorId?: string;
  paymentMethod?: string;
  rating?: number;
  status: "requested" | "active" | "completed" | "cancelled";
  to: string;
  vehicle: string;
}
