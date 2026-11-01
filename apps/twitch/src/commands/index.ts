import { clear } from './clear'
import { join } from './join'
import { leave } from './leave'
import { open } from './open'
import { pause } from './pause'
import { ping } from './ping'
import { pos } from './pos'
import { done, play, returnToQueue } from './turn'
import type { TwitchCommand } from './types'
import { view } from './view'

// `!nxt <name>` → command. Add new subcommands here.
export const commands: Record<string, TwitchCommand> = {
    clear,
    done,
    join,
    leave,
    open,
    pause,
    ping,
    play,
    pos,
    return: returnToQueue,
    view,
}
