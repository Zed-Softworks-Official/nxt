import { tryCatch } from './try-catch'

// Runs `run` whenever the returned trigger is called, never two at once. A
// trigger during a run queues exactly one more run afterwards. Bots use it to
// deliver Announcements on every outbox subscription update.
export function serialRunner(run: () => Promise<void>) {
    let running = false
    let again = false
    const loop = async () => {
        running = true
        do {
            again = false
            const { error } = await tryCatch(run())
            if (error) console.error('Serial run failed', error)
        } while (again)
        running = false
    }
    return () => {
        if (running) {
            again = true
            return
        }
        void loop()
    }
}
