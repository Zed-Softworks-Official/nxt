---
status: accepted
---

# Discord queue admins are Manage Server members

The Community owner is a Clerk user, and nothing links that person to a Discord account, so a slash command cannot check "is this the owner?" An Admin is any Discord member with Manage Server in the guild where the command was run. The admin commands declare that permission and check it again when they run. Server owners and members with Administrator pass that check, because Discord treats both as having every permission.

## Considered options

- **Community owner only.** Rejected until a Discord identity exists for the owner. It would also lock out every other person who already runs the server.
- **A custom bot role.** Rejected because the Queue could not be opened until someone created and assigned that role.

## Consequences

- Any member with Manage Server can open, pause, and clear the Queue, and can set the Command channel, including people who did not create the Community.
- Switching later to owner-only means those managers lose the commands, or the owner must gain a stored Discord identity first.
