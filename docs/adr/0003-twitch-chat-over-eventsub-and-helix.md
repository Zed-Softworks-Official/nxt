---
status: accepted
---

# Twitch chat uses EventSub and the Send Chat Message API

The Twitch adapter receives `channel.chat.message` through EventSub and replies through the Helix Send Chat Message endpoint, signed in as the Nxt bot account. It uses Twurple for both. It does not keep an IRC `ChatClient` connection open. The adapter runs as its own Node service in `apps/twitch`, set up like `apps/discord`, and Convex remains the only store of Queue state.

## Considered options

- **Inside Convex**, with HTTP actions receiving EventSub and actions calling Helix. Rejected. It gives up most of what Twurple provides, and Nxt would have to persist and refresh the bot token itself.
- **Twurple `ChatClient` over IRC.** Rejected. Twitch recommends EventSub and the API for new chatbots, and an IRC client needs a connection open to every linked channel for as long as Nxt runs.

## Consequences

- Each Twitch Platform Link needs its own EventSub subscription, which Nxt creates when the channel is linked and deletes when it is unlinked.
- Moderator checks come from the badges on each chat event, so the adapter does not call the API for every command.
- The Nxt bot account grants `user:read:chat`, `user:write:chat`, and `user:bot`. Each linking broadcaster grants `channel:bot`, which lets the subscription and replies use an app access token.
- Twitch commands use one prefix, `!nxt <command>`, so they do not collide with other bots in the channel.
