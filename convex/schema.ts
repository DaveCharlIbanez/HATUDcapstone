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
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
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
    // Optional so the field can be added without a backfill: an operator
    // without a value predates the approval flow and counts as approved.
    approvalStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected")
      )
    ),
    // Why the last application was refused, shown to the driver so they can
    // fix it and resubmit.
    rejectionNote: v.optional(v.string()),
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

  // The credential documents a driver uploads for review. One row per
  // document kind, so a replacement never rewrites the operator record.
  operatorDocuments: defineTable({
    operatorId: v.id("operators"),
    kind: v.union(
      v.literal("license"),
      v.literal("registration"),
      v.literal("officialReceipt"),
      v.literal("insurance")
    ),
    storageId: v.string(),
    contentType: v.string(),
    size: v.number(),
    fileName: v.optional(v.string()),
    uploadedAt: v.number(),
    replacedCount: v.optional(v.number()),
  })
    .index("by_operatorId", ["operatorId"])
    .index("by_operatorId_and_kind", ["operatorId", "kind"]),

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
      v.union(
        v.literal("standard"),
        v.literal("priority"),
        v.literal("motorcycle_with_pillion"),
        v.literal("motorcycle_standard"),
        v.literal("motorcycle_family")
      )
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
    // When the request was dropped. `updatedAt` cannot be used for this: it
    // is bumped by every unrelated patch on the ride.
    cancelledAt: v.optional(v.number()),
    paymentStatus: v.optional(
      v.union(
        v.literal("unpaid"),
        v.literal("pending"),
        v.literal("paid"),
        v.literal("failed")
      )
    ),
    paidAt: v.optional(v.number()),
    operatorLocation: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
        updatedAt: v.number(),
      })
    ),
    commuterLocation: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
        updatedAt: v.number(),
      })
    ),
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

  payments: defineTable({
    rideId: v.id("rides"),
    commuterId: v.id("commuters"),
    amount: v.number(),
    currency: v.literal("PHP"),
    provider: v.literal("gcash"),
    providerRef: v.string(),
    referenceNumber: v.string(),
    status: v.union(
      v.literal("PENDING"),
      v.literal("AUTHORIZED"),
      v.literal("SETTLED"),
      v.literal("FAILED"),
      v.literal("EXPIRED"),
      v.literal("REFUNDED")
    ),
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_rideId", ["rideId"])
    .index("by_commuterId", ["commuterId"]),

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
  }).index("by_email", ["email"]),

  messages: defineTable({
    rideId: v.id("rides"),
    senderId: v.id("users"),
    senderRole: v.union(
      v.literal("commuter"),
      v.literal("operator"),
      v.literal("admin")
    ),
    content: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_rideId", ["rideId"])
    .index("by_createdAt", ["createdAt"]),
});
