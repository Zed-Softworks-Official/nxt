import { internal } from '@nxt/backend/api'
import { cronJobs } from 'convex/server'

const crons = cronJobs()

crons.interval(
    'prune settled announcements',
    { hours: 1 },
    internal.announcements.prune,
    {}
)

crons.interval(
    'prune expired pairing requests',
    { hours: 1 },
    internal.pairedDecks.prune,
    {}
)

export default crons
