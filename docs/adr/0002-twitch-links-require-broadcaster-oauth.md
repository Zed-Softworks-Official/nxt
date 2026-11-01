---
status: accepted
---

# Twitch channels are linked by their broadcaster

Only the Community owner can link or unlink a Twitch channel, and they do it from the dashboard. The Twitch OAuth grant must come from that channel's broadcaster. Nxt links the channel whose broadcaster signed in. The owner never types a channel name. Twitch Admins (the broadcaster and active moderators) run the Queue from chat, but they cannot change the Platform Link.

## Considered options

- **Any Twitch moderator can link a channel from chat.** Rejected. Moderators could then attach a channel to a Community that its broadcaster never agreed to.
- **The owner types a channel name, with no OAuth.** Rejected. Nothing proves the owner controls that channel, and the bot needs the broadcaster's consent to post as a chatbot in it.

## Consequences

- The broadcaster's grant is stored on the Platform Link, so Nxt must refresh it, and it must handle the grant being revoked.
- Unlike Discord (ADR-0001), Nxt does know a Twitch identity for the person who linked the channel. Twitch Admin checks still use the channel's moderator list, not that identity.
