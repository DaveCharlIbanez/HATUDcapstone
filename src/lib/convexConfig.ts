export const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";

export function getConvexUrl(): string {
  if (!convexUrl) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL is not set. Add it to .env.local or run `npx convex dev`."
    );
  }
  return convexUrl;
}

export type ConvexUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "commuter" | "operator" | "admin";
  createdAt: string;
  lastLoginAt?: string;
};

export type ConvexAuthSession = {
  userId: string;
  token: string;
  issuedAt: string;
  expiresAt: string;
};

export type ConvexOperatorProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  plate: string;
  region: string;
  rating: number;
  earnings: number;
  ridesToday: number;
};

export type ConvexCommuterProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  joinDate: string;
  totalRides: number;
  rating: number;
  totalSpent: number;
};

export type ConvexRide = {
  id: string;
  commuterId: string;
  operatorId?: string;
  from: string;
  to: string;
  vehicle: string;
  status: "requested" | "active" | "completed" | "cancelled";
  cost: number;
  rating?: number;
  createdAt: string;
};

export type ConvexPaymentMethod = {
  id: string;
  commuterId: string;
  type: "card" | "cash";
  brand?: string;
  last4?: string;
  isDefault: boolean;
};
