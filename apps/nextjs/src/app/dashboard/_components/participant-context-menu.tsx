'use client'

import {
    ArrowDownToLine,
    ArrowUp,
    ArrowUpToLine,
    BellRing,
    CheckCheck,
    Trash2,
    Undo2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '~/components/ui/context-menu'
import { useQueueActions } from '../_lib/queue-actions'

type Target = { reference: number; username: string }

// What the row is, which decides the menu's items. A waiting row also says
// where Move to back lands (after the last waiting Participant), or null when
// it is already at the back.
export type RowState =
    | { kind: 'waiting'; atFront: boolean; backAfter: number | null }
    | { kind: 'pinged' }
    | { kind: 'playing' }

// The right-click (long-press on touch) menu on a Participant row. The row
// itself is passed as children and becomes the trigger.
export function ParticipantContextMenu(props: {
    participant: Target
    state: RowState
    children: ReactNode
}) {
    const actions = useQueueActions()
    const { participant: target, state } = props

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>{props.children}</ContextMenuTrigger>
            <ContextMenuContent className="w-44">
                {state.kind === 'waiting' && (
                    <>
                        <ContextMenuItem
                            onSelect={() => actions.pingOne(target)}
                        >
                            <BellRing />
                            Ping
                        </ContextMenuItem>
                        <ContextMenuItem
                            disabled={state.atFront}
                            onSelect={() =>
                                actions.move(target, { toFront: true })
                            }
                        >
                            <ArrowUpToLine />
                            Move to front
                        </ContextMenuItem>
                        <ContextMenuItem
                            disabled={state.backAfter === null}
                            onSelect={() => {
                                if (state.backAfter === null) return
                                actions.move(target, { after: state.backAfter })
                            }}
                        >
                            <ArrowDownToLine />
                            Move to back
                        </ContextMenuItem>
                    </>
                )}
                {state.kind === 'pinged' && (
                    <>
                        <ContextMenuItem onSelect={() => actions.play(target)}>
                            <ArrowUp />
                            Playing
                        </ContextMenuItem>
                        <ContextMenuItem
                            onSelect={() => actions.returnToQueue(target)}
                        >
                            <Undo2 />
                            Back
                        </ContextMenuItem>
                    </>
                )}
                {state.kind === 'playing' && (
                    <ContextMenuItem onSelect={() => actions.done(target)}>
                        <CheckCheck />
                        Done
                    </ContextMenuItem>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem
                    variant="destructive"
                    onSelect={() => actions.remove(target)}
                >
                    <Trash2 />
                    Remove
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    )
}
