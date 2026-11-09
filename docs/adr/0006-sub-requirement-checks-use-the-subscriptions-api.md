---
status: accepted
---

# Sub requirement checks use the Twitch subscriptions API

When a Sub requirement is on, Nxt checks each non-Admin Twitch join with Helix Get Broadcaster Subscriptions, using the broadcaster's grant, including for the Any sub setting. It does not read chat badges for this, even though ADR-0003 reads moderator status from them. Twitch documents the subscriber badge's metadata as months subscribed, not tier, and a paying sub wrongly refused is the worst failure this feature can have. One authoritative path also means Any sub and the tier settings cannot disagree.

## Considered options

- **Chat badges for Any sub, the API for tiers.** Rejected. Any sub would work without a new permission, but there would be two ways of checking. Founders may also wear a separate `founder` badge instead of `subscriber`, which could refuse them.
- **The viewer's own OAuth, through Check User Subscription.** Rejected. Twitch requires a token from the subscriber, so every viewer would have to sign in to Nxt before typing `!joinq`.

## Consequences

- Each Twitch Platform Link must grant `channel:read:subscriptions` as well as `channel:bot`. This lets Nxt read the broadcaster's subscriber list. Existing links get it through a Reconnect that keeps the same channel and does not unlink, because unlinking removes that platform's waiting Participants.
- The check runs in a Convex action that owns the grant, and it refreshes the grant when needed. ADR-0002 said Nxt must refresh and handle revoked grants, but neither existed when this was decided, so this work builds them. Keeping refresh in one place stops services overwriting each other's copy of a refresh token.
- If the check cannot run, the join is refused with a message saying so, and the Sub requirement stays on. A paying sub can be turned away during a Twitch outage. Letting everyone in instead would break the restriction with no way to pick those people out afterwards.
- This is Nxt's first Twitch API call for a chat command. It runs only when the person is not already waiting, the Queue is Open, Joins are on for Twitch, and they are not a Twitch Admin. A refused person goes on the existing cooldown so repeat attempts cannot flood chat or the API.
