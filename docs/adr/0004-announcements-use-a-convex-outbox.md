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

## Failed Announcements

The dashboard warns the Community owner when a Participant was Pinged but has not been told. An Announcement counts as failed once it has been pending for 30 seconds. The Participant stays Pinged, because undoing the call would move people in the Queue because of a platform outage.

Bots retry pending Announcements on a timer, not only when the pending set changes. The mutation that moves a Participant out of Pinged also drops their pending Announcement, so a late post cannot call someone who has moved on, and a second Ping cannot post twice. An Announcement still pending after 24 hours is dropped too, so posts that can never succeed cannot fill the pending read and block other Communities. Dropped Announcements never count as failed, so a warning clears at that limit even though the Participant was not told.

- **Bots report each failed post.** Rejected. It would give an instant failure with a reason, but a bot that is down cannot report anything, so it would also need heartbeats. The pending age covers failed posts and a downed bot with one rule, at the cost of a 30-second delay and no reason to show.
