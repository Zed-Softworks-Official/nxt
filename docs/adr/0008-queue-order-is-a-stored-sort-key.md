---
status: accepted
---

# Queue order is a stored sort key

The Queue used to be ordered by when each entry was created, which made Move impossible. Each Participant now gets a sortable order key when they join, placed after every existing key, so new joiners still go to the back. A Move gives the Participant a new key between the keys of its new neighbours, which changes only that one row. Ping, Position and every Queue view sort by this key. A Participant sent Back keeps their key, so they return to the place they held when they were Pinged, including any earlier Move.

The dashboard asks for a Move relative to neighbours ("after q-17", or "to the front"), because that matches what the Admin saw when they dropped the row, even if other people joined or left during the drag. Chat commands ask for a Position, because that is what Admins can see in chat. Both are resolved to neighbours in the same backend Move.

## Considered options

- **Keep creation-time order and store an index on each row.** Rejected. Every Move would renumber every row between the old and new spots, so a busy Queue would rewrite many rows and clash with joins happening at the same time.
- **A linked list (each row points to the next).** Rejected. Working out Position and the front N would mean walking the list on every read.
- **Order only in the dashboard view.** Rejected. Ping and `!pos` would disagree with what the Admin sees.

## Consequences

- Existing waiting rows need a key backfilled from their creation time before ordering switches over.
- Keys can get long after many Moves into the same gap. Keys are rebalanced when that happens.
