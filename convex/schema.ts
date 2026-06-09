import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    phone: v.string(),
    role: v.union(
      v.literal("commuter"),
      v.literal("operator"),
      v.literal("admin")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_phone", ["phone"])
    .index("by_role", ["role"]),

  commuters: defineTable({
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    savedLocations: v.array(
      v.object({
        name: v.string(),
        address: v.string(),
        latitude: v.number(),
        longitude: v.number(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"]),

  operators: defineTable({
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    licenseNumber: v.string(),
    vehicleInfo: v.object({
      plateNumber: v.string(),
      model: v.string(),
      color: v.string(),
    }),
    isAvailable: v.boolean(),
    currentLocation: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_license", ["licenseNumber"])
    .index("by_isAvailable", ["isAvailable"]),

  admins: defineTable({
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    permissions: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"]),

  rides: defineTable({
    commuterId: v.id("commuters"),
    operatorId: v.optional(v.id("operators")),
    pickup: v.object({
      address: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    }),
    dropoff: v.object({
      address: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    }),
    vehicleType: v.optional(
      v.union(v.literal("economy"), v.literal("comfort"), v.literal("xl"))
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("inProgress"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    fare: v.number(),
    distance: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_commuterId", ["commuterId"])
    .index("by_operatorId", ["operatorId"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  feedback: defineTable({
    rideId: v.id("rides"),
    commuterId: v.id("commuters"),
    operatorId: v.id("operators"),
    rating: v.number(),
    comment: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_rideId", ["rideId"])
    .index("by_operatorId", ["operatorId"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    isRevoked: v.boolean(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  loginAttempts: defineTable({
    email: v.string(),
    count: v.number(),
    lastAttemptAt: v.number(),
    lockedUntil: v.optional(v.number()),
  })
    .index("by_email", ["email"]),
});
