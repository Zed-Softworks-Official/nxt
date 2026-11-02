---
status: accepted
---

# Turn commands target Participant references

Every Queue entry gets a Participant reference, such as `q-42`. It is unique within the Community. It stays the same while that entry is waiting, Pinged, or Playing, including when the Participant returns to the Queue. It is never reused after the turn is done. Queue views and Ping Announcements show it, and Turn commands take it as their target, as in `!nxt play q-42` on Twitch or `/play q-42` on Discord. Ping takes a count, not a reference, and calls the front of the Queue.

The dashboard, Discord, and Twitch offer the same Turn commands (ping, play, return, done), backed by the same backend mutations. Admins on any linked platform can therefore act on Participants from any other platform.

## Considered options

- **Target by username.** Rejected. Usernames collide across platforms, and Twitch users can rename. A Twitch Admin cannot mention a Discord user.
- **Target by platform user ID.** Rejected. Those IDs are long, specific to one platform, and not shown in chat.
- **Act only on the oldest Pinged or Playing Participant.** Rejected. It cannot handle several Pinged Participants when only some of them show up.
- **Turn commands only in the dashboard and on Twitch.** Rejected. A Twitch moderator would have more power over the shared Queue than a Discord Admin.

## Consequences

- Participants need a reference column and a counter for each Community, assigned when someone joins.
- Discord gets new Admin slash commands. They are gated the same way as the existing ones (ADR-0001).
- The backend's Turn mutations must stop resolving the Queue through `ownerId` alone, so that platform adapters can call them with their own Admin checks.
