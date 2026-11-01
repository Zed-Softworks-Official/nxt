# Nxt

A Community runs one Queue of people waiting for a turn. Discord, Twitch, and YouTube are ways those people show up.

## Language

**Community**:
The group that owns one Queue. The Queue exists from the moment the Community does.
_Avoid_: server, guild, account

**Community owner**:
The Clerk user who owns a Community and is the only person who may create or remove its Platform Links, from the dashboard. A Community owner does not automatically have Admin authority in a linked platform.
_Avoid_: Admin, broadcaster

**Platform Link**:
An enabled connection between a Community and a platform space, such as a Discord guild or Twitch channel. Its Participants share the Community's Queue. Removing a Platform Link removes that platform's waiting Participants. Its Pinged and Playing Participants stay until their turn ends.
_Avoid_: integration, server connection

**Queue**:
The ordered line of Participants who are waiting, earliest join first. It starts Paused. Clearing it removes every waiting Participant and leaves pinged and playing Participants in place.
_Avoid_: pinged list, now playing, the full set of Participants

**Participant**:
A platform identity in one Community's turn. The same person on different platforms is a different Participant and may have a separate Queue entry.
_Avoid_: user, player, member

**Participant reference**:
A public, stable identifier for a Participant's current Queue entry. Admins use it to identify that Participant across platforms.
_Avoid_: username, platform ID

**Pinged**:
A Participant who has been called and is no longer in the Queue. Nxt announces the call on the Participant's own platform (the linked Command channel or Twitch channel), wherever the Admin who called them was.
_Avoid_: notified, on deck

**Playing**:
A Participant who is taking their turn. Not in the Queue.
_Avoid_: live, active, current

**Announcement**:
A message Nxt owes to one platform space about a Queue change, such as a Participant being Pinged. Turn changes record it in Convex. The adapter for that platform posts it and marks it delivered.
_Avoid_: notification, event, message

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
A member of a Platform Link who may administer a Community's Queue. A Discord Admin has Manage Server in the linked guild; a Twitch Admin is the broadcaster or an active channel moderator. An Admin is not the Community's owner.
_Avoid_: owner, universal administrator

**Command channel**:
The Discord text channel in a guild where Participants run Queue commands. A thread does not qualify. Until one is chosen, those commands work in any channel. Admins are not limited to it.
_Avoid_: announcement channel, listen channel, thread

**Twitch channel**:
A broadcaster's public Twitch chat linked to a Community. Participants run Queue commands there and receive public `@user` replies from Nxt's bot account. Twitch has no private replies, so Nxt does not whisper. Queue commands work whether or not the broadcaster is live.
_Avoid_: command channel, room

**Nxt bot account**:
The Nxt-operated Twitch account that receives Queue commands and posts replies in every linked Twitch channel.
_Avoid_: broadcaster account, Community account

**Turn command**:
An Admin command that moves Participants between the Queue, Pinged, and Playing: ping, play, return, and done. Discord, Twitch, and the dashboard offer the same Turn commands.
_Avoid_: dashboard action, mod command

**Activity log**:
The history of turns on a Queue: a Participant being pinged, returning to the Queue, or finishing. Joining, leaving, and clearing the Queue are not turns.
_Avoid_: audit log, queue history
