import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const signup = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    password: v.string(),
    role: v.union(
      v.literal("commuter"),
      v.literal("operator"),
      v.literal("admin")
    ),
    licenseNumber: v.optional(v.string()),
    vehicleInfo: v.optional(
      v.object({
        plateNumber: v.string(),
        model: v.string(),
        color: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existingEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingEmail) {
      throw new Error("Email already registered");
    }

    const existingPhone = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    if (existingPhone) {
      throw new Error("Phone number already registered");
    }

    const passwordHash = await hashPassword(args.password);

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      email: args.email,
      passwordHash,
      phone: args.phone,
      role: args.role,
      createdAt: now,
      updatedAt: now,
    });

    if (args.role === "commuter") {
      await ctx.db.insert("commuters", {
        userId,
        name: args.name,
        email: args.email,
        phone: args.phone,
        savedLocations: [],
        createdAt: now,
        updatedAt: now,
      });
    } else if (args.role === "operator") {
      if (!(args.licenseNumber && args.vehicleInfo)) {
        throw new Error("Operator requires license number and vehicle info");
      }
      await ctx.db.insert("operators", {
        userId,
        name: args.name,
        email: args.email,
        phone: args.phone,
        licenseNumber: args.licenseNumber,
        vehicleInfo: args.vehicleInfo,
        isAvailable: false,
        currentLocation: undefined,
        createdAt: now,
        updatedAt: now,
      });
    } else if (args.role === "admin") {
      await ctx.db.insert("admins", {
        userId,
        name: args.name,
        email: args.email,
        permissions: ["view_all", "manage_users", "view_analytics"],
        createdAt: now,
        updatedAt: now,
      });
    }

    return { userId };
  },
});

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("Invalid email or password");
    }

    const isValid = await verifyPassword(args.password, user.passwordHash);
    if (!isValid) {
      throw new Error("Invalid email or password");
    }

    await ctx.db.patch(user._id, { updatedAt: Date.now() });

    let profile = null;
    if (user.role === "commuter") {
      profile = await ctx.db
        .query("commuters")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .first();
    } else if (user.role === "operator") {
      profile = await ctx.db
        .query("operators")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .first();
    } else if (user.role === "admin") {
      profile = await ctx.db
        .query("admins")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .first();
    }

    return {
      userId: user._id,
      role: user.role,
      profile,
    };
  },
});

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "hatud_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}
