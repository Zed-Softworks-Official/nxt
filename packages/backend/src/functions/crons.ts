import { internal } from '@nxt/backend/api'
import { cronJobs } from 'convex/server'

const crons = cronJobs()

crons.interval(
    'prune settled announcements',
    { hours: 1 },
    internal.announcements.prune,
    {}
)

export default crons
