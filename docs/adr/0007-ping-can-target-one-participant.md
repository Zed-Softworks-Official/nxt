---
status: accepted
---

# Ping can target one Participant

This replaces one line of ADR-0005: "Ping takes a count, not a reference, and calls the front of the Queue." Ping now takes either a count, which calls the front N as before, or one waiting Participant's reference, which calls only that Participant wherever they are in the Queue. A targeted Ping is the same as any other Ping: it uses the Saved ping note unless a note is typed, logs a `pinged` turn in the Activity log, and sends the usual Announcement. Admins needed a way to call someone out of order, for example a friend joining a group that is already playing, without pinging everyone ahead of them and sending those people Back.

The dashboard, Discord (`/pingq participant:q-42`) and Twitch (`!pingq q-42 [note]`) all offer it, so ADR-0005's rule that every platform has equal power still holds. Paired decks do not. A deck only has Quick Ping and its slot keys, and has no good way to choose a waiting Participant.

## Considered options

- **Move the Participant to the front, then Quick Ping 1.** Rejected. It takes two steps, two Admins acting at once could each call the wrong person, and the Queue order would change as a side effect.
- **Dashboard only.** Rejected. A dashboard user would have more power than Discord and Twitch Admins, which ADR-0005 rules out.
