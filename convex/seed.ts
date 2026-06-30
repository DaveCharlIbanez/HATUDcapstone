import { mutation } from "./_generated/server";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "hatud_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existingUsers = await ctx.db.query("users").first();
    if (existingUsers) {
      return { message: "Seed already exists" };
    }

    const now = Date.now();
    const passwordHashAdmin = await hashPassword("123456789");
    const passwordHashDefault = await hashPassword("password123");

    const adminUserId = await ctx.db.insert("users", {
      email: "admin@hatud.com",
      passwordHash: passwordHashAdmin,
      phone: "+639123456789",
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("admins", {
      userId: adminUserId,
      name: "Admin User",
      email: "admin@hatud.com",
      permissions: [
        "view_all",
        "manage_users",
        "view_analytics",
        "approve_operators",
      ],
      createdAt: now,
      updatedAt: now,
    });

    const commuter1UserId = await ctx.db.insert("users", {
      email: "commuter1@hatud.com",
      passwordHash: passwordHashDefault,
      phone: "+639234567890",
      role: "commuter",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("commuters", {
      userId: commuter1UserId,
      name: "Juan dela Cruz",
      email: "commuter1@hatud.com",
      phone: "+639234567890",
      savedLocations: [
        {
          name: "Home",
          address: "123 Mabini St, San Jose, Antique",
          latitude: 10.5944,
          longitude: 121.9494,
        },
        {
          name: "Work",
          address: "456 Cervantes St, San Jose, Antique",
          latitude: 10.5923,
          longitude: 121.9476,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    const commuter2UserId = await ctx.db.insert("users", {
      email: "commuter2@hatud.com",
      passwordHash: passwordHashDefault,
      phone: "+639345678901",
      role: "commuter",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("commuters", {
      userId: commuter2UserId,
      name: "Maria Santos",
      email: "commuter2@hatud.com",
      phone: "+639345678901",
      savedLocations: [
        {
          name: "School",
          address: "789 University Ave, Sibalom, Antique",
          latitude: 10.5132,
          longitude: 121.9423,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    const operator1UserId = await ctx.db.insert("users", {
      email: "operator1@hatud.com",
      passwordHash: passwordHashDefault,
      phone: "+639456789012",
      role: "operator",
      createdAt: now,
      updatedAt: now,
    });

    const operator1Id = await ctx.db.insert("operators", {
      userId: operator1UserId,
      name: "Roberto Reyes",
      email: "operator1@hatud.com",
      phone: "+639456789012",
      licenseNumber: "DR-2024-001",
      vehicleInfo: {
        plateNumber: "ABC 123",
        model: "Toyota Hilux",
        color: "White",
      },
      isAvailable: true,
      currentLocation: { latitude: 10.5944, longitude: 121.9494 },
      createdAt: now,
      updatedAt: now,
    });

    const operator2UserId = await ctx.db.insert("users", {
      email: "operator2@hatud.com",
      passwordHash: passwordHashDefault,
      phone: "+639567890123",
      role: "operator",
      createdAt: now,
      updatedAt: now,
    });

    const operator2Id = await ctx.db.insert("operators", {
      userId: operator2UserId,
      name: "Antonio Mendoza",
      email: "operator2@hatud.com",
      phone: "+639567890123",
      licenseNumber: "DR-2024-002",
      vehicleInfo: {
        plateNumber: "DEF 456",
        model: "Isuzu D-Max",
        color: "Blue",
      },
      isAvailable: true,
      currentLocation: { latitude: 10.5912, longitude: 121.9456 },
      createdAt: now,
      updatedAt: now,
    });

    const commuters = await ctx.db
      .query("commuters")
      .withIndex("by_email")
      .collect();

    const [firstCommuter, secondCommuter] = commuters;
    if (firstCommuter && secondCommuter) {
      const ride1 = await ctx.db.insert("rides", {
        commuterId: firstCommuter._id,
        operatorId: operator1Id,
        pickup: {
          address: "123 Mabini St, San Jose, Antique",
          latitude: 10.5944,
          longitude: 121.9494,
        },
        dropoff: {
          address: "456 Cervantes St, San Jose, Antique",
          latitude: 10.5923,
          longitude: 121.9476,
        },
        vehicleType: "economy",
        status: "inProgress",
        fare: 85.5,
        distance: 2.3,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("feedback", {
        rideId: ride1,
        commuterId: firstCommuter._id,
        operatorId: operator1Id,
        rating: 5,
        comment: "Great ride!",
        createdAt: now,
      });

      await ctx.db.insert("rides", {
        commuterId: secondCommuter._id,
        operatorId: operator2Id,
        pickup: {
          address: "789 University Ave, Sibalom, Antique",
          latitude: 10.5132,
          longitude: 121.9423,
        },
        dropoff: {
          address: "123 Mabini St, San Jose, Antique",
          latitude: 10.5944,
          longitude: 121.9494,
        },
        vehicleType: "xl",
        status: "pending",
        fare: 245.0,
        distance: 12.5,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("rides", {
        commuterId: firstCommuter._id,
        operatorId: operator1Id,
        pickup: {
          address: "456 Cervantes St, San Jose, Antique",
          latitude: 10.5923,
          longitude: 121.9476,
        },
        dropoff: {
          address: "Shopping Mall, San Jose, Antique",
          latitude: 10.5901,
          longitude: 121.9512,
        },
        vehicleType: "comfort",
        status: "completed",
        fare: 65.0,
        distance: 1.8,
        createdAt: now - 3_600_000,
        updatedAt: now - 3_600_000,
      });
    }

    return { message: "Seed completed successfully" };
  },
});

export const forceReset = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      await ctx.db.delete(user._id);
    }
    const admins = await ctx.db.query("admins").collect();
    for (const admin of admins) {
      await ctx.db.delete(admin._id);
    }
    const commuters = await ctx.db.query("commuters").collect();
    for (const commuter of commuters) {
      await ctx.db.delete(commuter._id);
    }
    const operators = await ctx.db.query("operators").collect();
    for (const operator of operators) {
      await ctx.db.delete(operator._id);
    }
    const rides = await ctx.db.query("rides").collect();
    for (const ride of rides) {
      await ctx.db.delete(ride._id);
    }
    const feedbacks = await ctx.db.query("feedback").collect();
    for (const feedback of feedbacks) {
      await ctx.db.delete(feedback._id);
    }

    const now = Date.now();
    const passwordHashAdmin = await hashPassword("123456789");
    const passwordHashDefault = await hashPassword("password123");

    const adminUserId = await ctx.db.insert("users", {
      email: "admin@hatud.com",
      passwordHash: passwordHashAdmin,
      phone: "+639123456789",
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("admins", {
      userId: adminUserId,
      name: "Admin User",
      email: "admin@hatud.com",
      permissions: [
        "view_all",
        "manage_users",
        "view_analytics",
        "approve_operators",
      ],
      createdAt: now,
      updatedAt: now,
    });

    const commuter1UserId = await ctx.db.insert("users", {
      email: "commuter1@hatud.com",
      passwordHash: passwordHashDefault,
      phone: "+639234567890",
      role: "commuter",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("commuters", {
      userId: commuter1UserId,
      name: "Juan dela Cruz",
      email: "commuter1@hatud.com",
      phone: "+639234567890",
      savedLocations: [
        {
          name: "Home",
          address: "123 Mabini St, San Jose, Antique",
          latitude: 10.5944,
          longitude: 121.9494,
        },
        {
          name: "Work",
          address: "456 Cervantes St, San Jose, Antique",
          latitude: 10.5923,
          longitude: 121.9476,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    const commuter2UserId = await ctx.db.insert("users", {
      email: "commuter2@hatud.com",
      passwordHash: passwordHashDefault,
      phone: "+639345678901",
      role: "commuter",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("commuters", {
      userId: commuter2UserId,
      name: "Maria Santos",
      email: "commuter2@hatud.com",
      phone: "+639345678901",
      savedLocations: [
        {
          name: "School",
          address: "789 University Ave, Sibalom, Antique",
          latitude: 10.5132,
          longitude: 121.9423,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    const operator1UserId = await ctx.db.insert("users", {
      email: "operator1@hatud.com",
      passwordHash: passwordHashDefault,
      phone: "+639456789012",
      role: "operator",
      createdAt: now,
      updatedAt: now,
    });

const operator1Id = await ctx.db.insert("operators", {
      userId: operator1UserId,
      name: "Roberto Reyes",
      email: "operator1@hatud.com",
      phone: "+639456789012",
      licenseNumber: "DR-2024-001",
      vehicleInfo: {
        plateNumber: "ABC 123",
        model: "Toyota Hilux",
        color: "White",
      },
      isAvailable: true,
      currentLocation: { latitude: 10.5944, longitude: 121.9494 },
      createdAt: now,
      updatedAt: now,
    });

    const operator2UserId = await ctx.db.insert("users", {
      email: "operator2@hatud.com",
      passwordHash: passwordHashDefault,
      phone: "+639567890123",
      role: "operator",
      createdAt: now,
      updatedAt: now,
    });

    const operator2Id = await ctx.db.insert("operators", {
      userId: operator2UserId,
      name: "Antonio Mendoza",
      email: "operator2@hatud.com",
      phone: "+639567890123",
      licenseNumber: "DR-2024-002",
      vehicleInfo: {
        plateNumber: "DEF 456",
        model: "Isuzu D-Max",
        color: "Blue",
      },
      isAvailable: true,
      currentLocation: { latitude: 10.5912, longitude: 121.9456 },
      createdAt: now,
      updatedAt: now,
    });

    const commutersData = await ctx.db
      .query("commuters")
      .withIndex("by_email")
      .collect();

    const [firstCommuterData, secondCommuterData] = commutersData;
    if (firstCommuterData && secondCommuterData) {
      const ride1 = await ctx.db.insert("rides", {
        commuterId: firstCommuterData._id,
        operatorId: operator1Id,
        pickup: {
          address: "123 Mabini St, San Jose, Antique",
          latitude: 10.5944,
          longitude: 121.9494,
        },
        dropoff: {
          address: "456 Cervantes St, San Jose, Antique",
          latitude: 10.5923,
          longitude: 121.9476,
        },
        vehicleType: "economy",
        status: "inProgress",
        fare: 85.5,
        distance: 2.3,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("feedback", {
        rideId: ride1,
        commuterId: firstCommuterData._id,
        operatorId: operator1Id,
        rating: 5,
        comment: "Great ride!",
        createdAt: now,
      });

      await ctx.db.insert("rides", {
        commuterId: secondCommuterData._id,
        operatorId: operator2Id,
        pickup: {
          address: "789 University Ave, Sibalom, Antique",
          latitude: 10.5132,
          longitude: 121.9423,
        },
        dropoff: {
          address: "123 Mabini St, San Jose, Antique",
          latitude: 10.5944,
          longitude: 121.9494,
        },
        vehicleType: "xl",
        status: "pending",
        fare: 245.0,
        distance: 12.5,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("rides", {
        commuterId: firstCommuterData._id,
        operatorId: operator1Id,
        pickup: {
          address: "456 Cervantes St, San Jose, Antique",
          latitude: 10.5923,
          longitude: 121.9476,
        },
        dropoff: {
          address: "Shopping Mall, San Jose, Antique",
          latitude: 10.5901,
          longitude: 121.9512,
        },
        vehicleType: "comfort",
        status: "completed",
        fare: 65.0,
        distance: 1.8,
        createdAt: now - 3_600_000,
        updatedAt: now - 3_600_000,
      });
    }

    return { message: "Database reset and re-seeded successfully" };
  },
});
