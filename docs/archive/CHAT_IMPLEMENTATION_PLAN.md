# Chat Feature Implementation Plan

**Date:** September 11, 2026
**Goal:** Enable real-time messaging between commuter and operator during active rides

---

## Executive Summary

This document outlines the implementation plan for a ride chat feature that allows commuters and operators to communicate during active rides. It includes potential bottlenecks, conflict analysis, and mitigation strategies.

---

## 1. Database Schema

### 1.1 New Table: `messages`

**File:** `convex/schema.ts`

```typescript
messages: defineTable({
  rideId: v.id("rides"),
  senderId: v.id("users"),
  senderRole: v.union(v.literal("commuter"), v.literal("operator")),
  content: v.string(),
  read: v.boolean(),
  createdAt: v.number(),
})
  .index("by_rideId", ["rideId"])
  .index("by_createdAt", ["createdAt"])
```

**Rationale:**
- `rideId` links message to a specific ride for security checks
- `senderRole` enables quick filtering without joining to users table
- `read` flag enables unread message tracking
- Indexes support efficient querying by ride and chronological order

---

## 2. Backend API (Convex)

### 2.1 New File: `convex/messages.ts`

#### Queries

```typescript
// Get all messages for a ride (paginated)
export const getByRide = query({
  args: { rideId: v.id("rides"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Security: validate user is part of this ride
    // Return messages ordered by createdAt ASC
  },
});

// Real-time subscription
export const subscribeToRideMessages = query({
  args: { rideId: v.id("rides") },
  handler: async (ctx, args) => {
    // Return ISR (Incremental Static Results) subscription
  },
});
```

#### Mutations

```typescript
// Send a message
export const send = mutation({
  args: {
    sessionToken: v.string(),
    rideId: v.id("rides"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Validate session
    // 2. Verify user is part of ride (commuter or operator)
    // 3. Verify ride status is "accepted" or "inProgress"
    // 4. Sanitize content (max 500 chars)
    // 5. Insert message
  },
});

// Mark messages as read
export const markAsRead = mutation({
  args: { sessionToken: v.string(), rideId: v.id("rides") },
  handler: async (ctx, args) => {
    // Mark all unread messages from the OTHER party as read
  },
});
```

---

## 3. Security Model

### 3.1 Authorization Matrix

| Action | Commuter | Operator | Admin |
|--------|----------|----------|-------|
| Send message | Own ride only | Assigned ride only | All rides |
| Read messages | Own ride only | Assigned ride only | All rides |
| Mark as read | Own ride only | Assigned ride only | All rides |

### 3.2 Ride Status Checks

Messages can only be sent when ride status is:
- `accepted` - Driver accepted, en route to pickup
- `inProgress` - Trip ongoing

Messages CAN be read after ride ends (for history), but sending is blocked.

### 3.3 Input Validation

- **Content length:** Max 500 characters
- **Content sanitization:** Strip HTML tags, trim whitespace
- **Rate limiting:** Max 1 message per second per user (client-side + server-side)

---

## 4. Frontend Components

### 4.1 Chat Bubble Component

**File:** `src/components/ChatBubble.tsx`

```tsx
interface ChatBubbleProps {
  rideId: string;
  partnerName: string;
  partnerRole: "commuter" | "operator";
  sessionToken: string;
}
```

**Visual Design:**
```
┌─────────────────────────┐
│  💬                     │  ← Collapsed state (56px circle)
│                      3  │     Unread badge (red)
└─────────────────────────┘

┌────────────────────────────┐
│ 👤 Partner Name        ✕   │  ← Expanded header
├────────────────────────────┤
│                            │
│   Message bubble (right)   │  ← Sent messages (blue)
│                            │
│ Message bubble (left)  │   │  ← Received messages (gray)
│                            │
├────────────────────────────┤
│ [Type a message...    ] ▶  │  ← Input area
└────────────────────────────┘
     320px × 420px max
```

**Position:**
- **Commuter page:** Bottom-right, 16px from edges, 80px from bottom
- **Operator page:** Top-right (to avoid map controls), 16px from edges
- **Z-index:** 50 (above map markers z-20, below modals)

### 4.2 Integration Points

**Commuter Page (`src/app/Commuters/page.tsx`):**
```tsx
{activeRide && (activeRide.status === "accepted" || activeRide.status === "inProgress") && (
  <ChatBubble
    rideId={activeRide._id}
    partnerName={matchedOperator?.name ?? "Driver"}
    partnerRole="operator"
    sessionToken={sessionToken}
  />
)}
```

**Operator Page (`src/app/operator/map/page.tsx`):**
```tsx
{activeRide && (activeRide.status === "accepted" || activeRide.status === "inProgress") && (
  <ChatBubble
    rideId={activeRide._id}
    partnerName={activeRideCommuter?.name ?? "Passenger"}
    partnerRole="commuter"
    sessionToken={sessionToken}
  />
)}
```

---

## 5. Potential Bottlenecks & Issues

### 5.1 Identified Issues

| # | Issue | Severity | Description |
|---|-------|----------|-------------|
| 1 | **Subscription Memory Leaks** | High | Subscriptions not cleaned up when ride ends could cause memory leaks |
| 2 | **Z-Index Conflicts** | Medium | Chat bubble may overlap with existing UI elements (map controls, bottom panels) |
| 3 | **Race Conditions** | Medium | Messages sent during ride status transitions may fail unexpectedly |
| 4 | **Map Interaction Blocking** | Medium | Chat panel may block touch events on the map |
| 5 | **Initial Load State** | Low | Messages may not load immediately, showing empty state |
| 6 | **Operator Panel Overlap** | Medium | Operator page has bottom ride panel at z-30; chat needs higher z-index |

### 5.2 Conflict Analysis

#### Conflict 1: Operator Map Page Layout
- **Current:** Bottom panel at `z-30` (line 403 in operator/map/page.tsx)
- **Chat Bubble:** Needs `z-50` minimum
- **Resolution:** Position chat in TOP-RIGHT corner for operators (different from commuters)

#### Conflict 2: Commuter Page Bottom Bar
- **Current:** Search results panel uses bottom positioning
- **Resolution:** Position chat at `bottom-20` (80px) to clear any bottom bars

#### Conflict 3: Real-time Subscription Timing
- **Issue:** When ride transitions from `accepted` → `inProgress`, subscription may briefly disconnect
- **Resolution:** Subscribe based on rideId, not status; messages remain readable after ride ends

#### Conflict 4: Session Token Handling
- **Current:** `sessionToken` is passed as prop; may be null during initial load
- **Resolution:** Show chat only after auth is confirmed and sessionToken is available

### 5.3 Mitigation Strategies

| Issue | Mitigation |
|-------|------------|
| Memory leaks | Use `useEffect` cleanup to unsubscribe when component unmounts or ride ends |
| Z-index conflicts | Use `z-50` for chat; test on both mobile and desktop |
| Race conditions | Show user-friendly error message if send fails; allow retry |
| Map blocking | Set `pointer-events-none` on chat container, `pointer-events-auto` on chat panel |
| Load states | Show skeleton loader while messages fetch |
| Initial load | Display "No messages yet" with prompt to start conversation |

---

## 5.4 Direct Fixes

Below are the specific code fixes to implement for each issue:

#### Fix 1: Subscription Memory Leaks

**Problem:** Subscriptions not cleaned up when component unmounts or ride ends.

**Solution:** Use Convex's subscription return value in cleanup function.

```tsx
// In ChatBubble.tsx
useEffect(() => {
  if (!rideId) return;

  const unsubscribe = api.messages.subscribeToRideMessages(
    { rideId },
    (messages) => setMessages(messages)
  );

  return () => {
    unsubscribe();
  };
}, [rideId]);
```

#### Fix 2: Z-Index Conflicts & Positioning

**Problem:** Chat overlaps with existing UI elements.

**Solution:** Use role-based positioning with explicit z-index.

```tsx
// In ChatBubble.tsx - use role-specific positioning
const positionClasses = partnerRole === "operator"
  ? "top-4 right-4"           // Operator: top-right, below header
  : "bottom-20 right-4";      // Commuter: bottom-right, above any bottom bars

return (
  <div className={`fixed ${positionClasses} z-50`}>
    {/* Chat UI */}
  </div>
);
```

**CSS Fix:** Add to globals.css to ensure proper stacking:
```css
/* Ensure chat stays above map markers and panels */
[class*="chat"] {
  z-index: 50;
}
```

#### Fix 3: Map Touch Event Blocking

**Problem:** Chat panel blocks map pan/zoom gestures.

**Solution:** Use pointer-events properly on container vs panel.

```tsx
// Container allows clicks to pass through when collapsed
<div className="fixed bottom-20 right-4 z-50 pointer-events-none">
  {/* Expanded panel captures events */}
  <div className="pointer-events-auto">
    {/* Chat content */}
  </div>
</div>
```

#### Fix 4: Operator Page Bottom Panel Overlap

**Problem:** Operator has bottom ride panel at z-30 that conflicts with chat.

**Solution:** Position operator chat in top-right corner (NOT bottom-right).

```tsx
// For operators - top-right positioning
const chatPosition = partnerRole === "operator"
  ? "top-16 right-4"    // Below operator header, above map
  : "bottom-20 right-4"; // Commuter stays bottom-right
```

#### Fix 5: Ride Status Race Conditions

**Problem:** Sending message during status transition fails without clear feedback.

**Solution:** Add optimistic UI with error boundary + retry.

```tsx
const handleSend = async () => {
  try {
    setIsSending(true);
    await sendMessage({ sessionToken, rideId, content });
    setContent(""); // Clear input on success
  } catch (error) {
    // Show toast error with retry option
    toast.error("Failed to send. Tap to retry.", {
      onClick: () => handleSend()
    });
  } finally {
    setIsSending(false);
  }
};
```

#### Fix 6: Initial Load State Handling

**Problem:** Messages show empty until subscription fires.

**Solution:** Show loading skeleton, then "start conversation" prompt.

```tsx
// Loading state
if (messages === undefined) {
  return (
    <div className="animate-pulse bg-slate-800 h-64 rounded-lg">
      Loading messages...
    </div>
  );
}

// Empty state - after load completes
if (messages.length === 0) {
  return (
    <div className="text-slate-400 text-center p-4">
      <p>No messages yet</p>
      <p className="text-sm">Start a conversation!</p>
    </div>
  );
}
```

#### Fix 7: Session Token Availability

**Problem:** sessionToken may be null during initial auth check.

**Solution:** Only render chat after auth is complete + token available.

```tsx
// In parent component - both conditions must be met
{isAuthenticated && sessionToken && activeRide?.status === "accepted" && (
  <ChatBubble
    rideId={activeRide._id}
    // ...other props
  />
)}
```

#### Fix 8: Convex Subscription Pattern

**Problem:** Need proper Convex ISR subscription for real-time updates.

**Solution:** Use the correct subscription API pattern.

```tsx
// convex/messages.ts - subscription query
export const subscribeToRideMessages = query({
  args: { rideId: v.id("rides") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_rideId", (q) => q.eq("rideId", args.rideId))
      .order("asc")
      .collect();
  },
});

// Frontend subscription
const messages = useQuery(
  api.messages.subscribeToRideMessages,
  { rideId },
  // No "real-time" flag needed - Convex handles ISR automatically
);
```

---

## 6. Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client A  │────▶│   Convex    │◀────│   Client B  │
│  (Commuter) │     │   Backend   │     │  (Operator) │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │  sendMessage()    │                   │
       │──────────────────▶│                   │
       │                   │  Validate auth    │
       │                   │  + ownership      │
       │                   │  + ride status    │
       │                   │                   │
       │                   │  Insert message   │
       │                   │  to database      │
       │                   │                   │
       │                   │  Trigger sub      │
       │                   │◀──────────────────│
       │                   │                   │
       │◀──────────────────│                   │
       │  Update UI        │                   │
       │  (auto-scroll)    │                   │
```

---

## 7. File Changes Summary

| File | Action | Notes |
|------|--------|-------|
| `convex/schema.ts` | Modify | Add `messages` table |
| `convex/messages.ts` | Create | New file - all message queries/mutations |
| `src/components/ChatBubble.tsx` | Create | Floating button + expanded panel |
| `src/app/Commuters/page.tsx` | Modify | Add ChatBubble integration |
| `src/app/operator/map/page.tsx` | Modify | Add ChatBubble integration |

---

## 8. Testing Checklist

- [ ] Commuter can send message to operator
- [ ] Operator can send message to commuter
- [ ] Messages appear in real-time on both devices
- [ ] Chat bubble shows only during `accepted`/`inProgress` status
- [ ] Unread count badge works correctly
- [ ] Chat doesn't block map interactions
- [ ] Chat positioning correct on both commuter and operator pages
- [ ] Message send fails gracefully with error message
- [ ] Cannot send message after ride is completed/cancelled
- [ ] Cannot read messages from rides user is not part of

---

## 9. Future Enhancements (Post-MVP)

1. **Typing indicators** - Show when other party is typing
2. **Push notifications** - Notify user of new messages when app is backgrounded
3. **Message history** - Allow viewing past ride conversations
4. **Image sharing** - Allow sending photos of pickup location
5. **Voice messages** - Quick audio clips for directions

---

## 10. Recommendation

**Proceed with implementation** with the following adjustments:

1. **Position chat differently** for operators (top-right vs bottom-right) to avoid UI conflicts
2. **Add subscription cleanup** in useEffect to prevent memory leaks
3. **Handle loading/error states** explicitly in UI
4. **Test on mobile devices** to verify touch interactions aren't blocked

The proposed plan integrates cleanly with the existing codebase by:
- Following existing auth patterns (`requireCommuterOwnership`, `requireOperatorOwnership`)
- Using existing Convex patterns for queries/mutations
- Leveraging existing UI component patterns (z-index, positioning)

No significant conflicts identified that would prevent successful implementation.

---

*Document prepared for review. Awaiting approval before implementation.*
