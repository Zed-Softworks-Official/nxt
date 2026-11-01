import { join } from './join'
import { leave } from './leave'
import { pos } from './pos'
import type { TwitchCommand } from './types'
import { view } from './view'

// `!nxt <name>` → command. Add new subcommands here.
export const commands: Record<string, TwitchCommand> = {
    join,
    leave,
    pos,
    view,
}
