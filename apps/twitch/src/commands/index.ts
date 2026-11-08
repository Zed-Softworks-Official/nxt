import { clear } from './clear'
import { join } from './join'
import { leave } from './leave'
import { ping } from './ping'
import { pos } from './pos'
import { open, pause } from './queueState'
import { subq } from './subq'
import { done, play, returnToQueue } from './turn'
import type { TwitchCommand } from './types'
import { view } from './view'

// `!<name>` → command. Names match the Discord slash commands. Add new
// commands here. A Map, so names like `constructor` or `__proto__` never
// resolve to an object's built-ins.
export const commands: ReadonlyMap<string, TwitchCommand> = new Map([
    ['clearq', clear],
    ['doneq', done],
    ['endq', pause],
    ['joinq', join],
    ['leaveq', leave],
    ['pingq', ping],
    ['playq', play],
    ['pos', pos],
    ['returnq', returnToQueue],
    ['startq', open],
    ['subq', subq],
    ['viewq', view],
])
