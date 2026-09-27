# Nxt

A Community runs one Queue of people waiting for a turn. Discord, Twitch, and YouTube are ways those people show up.

## Language

**Community**:
The group that owns one Queue. The Queue exists from the moment the Community does.
_Avoid_: server, guild, account

**Queue**:
The ordered line of Participants who are waiting, earliest join first. It starts Paused. Clearing it removes every waiting Participant and leaves pinged and playing Participants in place.
_Avoid_: pinged list, now playing, the full set of Participants

**Participant**:
A person on one platform in one Community's turn. The same person in another Community is a different Participant.
_Avoid_: user, player, member

**Pinged**:
A Participant who has been called and is no longer in the Queue.
_Avoid_: notified, on deck

**Playing**:
A Participant who is taking their turn. Not in the Queue.
_Avoid_: live, active, current

**Position**:
A waiting Participant's place in the Queue, starting at 1 at the front. A pinged or playing Participant has no Position.
_Avoid_: index, rank, spot

**Open**:
The Queue state in which Participants may join.
_Avoid_: started, live, active

**Paused**:
The Queue state in which Participants may not join. Waiting Participants may still leave and ask their Position.
_Avoid_: ended, closed, stopped

**Admin**:
A Discord member who may open the Queue, pause it, clear it, and choose the Command channel. Not the Community's owner.
_Avoid_: owner, moderator

**Command channel**:
The Discord text channel in a guild where Participants run Queue commands. A thread does not qualify. Until one is chosen, those commands work in any channel. Admins are not limited to it.
_Avoid_: announcement channel, listen channel, thread

**Activity log**:
The history of turns on a Queue: a Participant being pinged, returning to the Queue, or finishing. Joining, leaving, and clearing the Queue are not turns.
_Avoid_: audit log, queue history
