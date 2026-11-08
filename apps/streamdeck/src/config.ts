// Where the plugin talks to, baked in at build time by rollup (an installed
// plugin has no .env). See rollup.config.mjs and the README.
declare const __NXT_CONVEX_URL__: string
declare const __NXT_DASHBOARD_URL__: string

export const config = {
    /** The Convex deployment URL; empty when the build wasn't configured. */
    convexUrl: __NXT_CONVEX_URL__,
    /** The dashboard origin the pairing link points at. */
    dashboardUrl: __NXT_DASHBOARD_URL__,
}
