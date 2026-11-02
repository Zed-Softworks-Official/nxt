---
status: accepted
---

# Announcements use a Convex outbox

A Turn command can come from the dashboard, Discord, or Twitch, and it can affect a Participant on another platform. The mutation that changes the Queue also inserts Announcement rows, one for each platform space that must be told. Each bot subscribes to the undelivered Announcements for its own platform, posts them in its own format, and marks them delivered.

## Considered options

- **Convex calls Discord REST and Twitch Helix directly.** Rejected. Formatting and platform credentials would sit in the backend, and an announcement that fails while a platform is down would be lost.
- **Only the platform where the command ran replies.** Rejected in Q9, because a Participant on the other platform would be called without seeing it.

## Consequences

- There is a new `announcements` table. Because it is written in the same mutation as the state change, an Announcement exists exactly when the change happened.
- A bot that restarts picks up whatever it missed. Delivery is at least once, so a crash after posting but before marking can repeat a message.
- Delivered rows need pruning.
