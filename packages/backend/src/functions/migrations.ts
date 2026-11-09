import { internal } from '@nxt/backend/api'
import { internalMutation } from '@nxt/backend/server'
import { v } from 'convex/values'

// One-off data migrations. Each one runs in batches, scheduling the next batch
// until the table is done, and is safe to run again.
//
// Run from the dashboard or CLI:
//   npx convex run migrations:backfillParticipantOrderKeys

const DEFAULT_BATCH_SIZE = 100

/**
 * Give every Participant without an order key (ADR-0008) the key reads already
 * fall back to, its `_creationTime`, so join order is unchanged.
 */
export const backfillParticipantOrderKeys = internalMutation({
    args: {
        cursor: v.optional(v.union(v.string(), v.null())),
        batchSize: v.optional(v.number()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE
        const page = await ctx.db
            .query('participants')
            .paginate({ cursor: args.cursor ?? null, numItems: batchSize })
        for (const row of page.page) {
            if (row.orderKey === undefined) {
                await ctx.db.patch('participants', row._id, {
                    orderKey: row._creationTime,
                })
            }
        }
        if (!page.isDone) {
            await ctx.scheduler.runAfter(
                0,
                internal.migrations.backfillParticipantOrderKeys,
                { cursor: page.continueCursor, batchSize }
            )
        }
        return null
    },
})
