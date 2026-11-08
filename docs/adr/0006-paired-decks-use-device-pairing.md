---
status: accepted
---

# Paired decks authorize with a device-pairing secret, not Clerk

The Stream Deck plugin runs the Queue with the Community owner's authority, the same as the dashboard. It does not sign in with Clerk. Instead, the plugin shows a short pairing code, and the owner approves that code from the dashboard while signed in. The plugin then receives a long-lived secret, and it sends that secret on deck-specific Convex queries and mutations. This creates a second authorization path alongside Clerk. It exists because a Marketplace plugin is a headless local process that cannot hold a Clerk session.

## Considered options

- **Clerk as an OAuth identity provider, with a loopback redirect.** Rejected. Clerk's OAuth access tokens are not the JWTs that Convex auth accepts, so this needs extra plumbing. The tokens also expire, and the plugin would need a local HTTP listener.
- **The owner pastes a token from the dashboard into the plugin settings.** Rejected. The UX is clunkier, and the secret passes through the clipboard.

## Consequences

- Deck functions authorize by looking up the secret, not with `ctx.auth`. They must resolve the Community from the Paired deck and never from a client-supplied ID.
- Revoking a Paired deck must take effect immediately: its live subscription and any later presses fail.
- Store only a hash of the secret.

## Addendum: secret minting and the deck view

- The deck secret is minted when the plugin first polls after approval, not at approval. Only its hash is stored, so the plaintext secret is never written to the database, and the plugin receives it exactly once. Until then the deck has no secret and does not appear in the owner's list.
- The deck view exposes `announcementPendingSince` for each Pinged slot instead of a Failed flag. A query result does not change as time passes, so the plugin judges a Failed Announcement against its own clock with `isAnnouncementFailed`, as the dashboard does (ADR-0004).
