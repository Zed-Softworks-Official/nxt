import { clear } from './clear'
import { join } from './join'
import { leave } from './leave'
import { ping } from './ping'
import { pos } from './pos'
import { open, pause } from './queueState'
import { done, play, returnToQueue } from './turn'
import type { TwitchCommand } from './types'
import { view } from './view'

// `!nxt <name>` → command. Add new subcommands here. A Map, so names like
// `constructor` or `__proto__` never resolve to an object's built-ins.
export const commands: ReadonlyMap<string, TwitchCommand> = new Map([
    ['clear', clear],
    ['done', done],
    ['join', join],
    ['leave', leave],
    ['open', open],
    ['pause', pause],
    ['ping', ping],
    ['play', play],
    ['pos', pos],
    ['return', returnToQueue],
    ['view', view],
])
