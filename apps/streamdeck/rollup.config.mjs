import path from 'node:path'
import { fileURLToPath } from 'node:url'

import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
import esbuild from 'rollup-plugin-esbuild'

// Bundles the plugin, workspace code and `convex` included, into
// dev.zedsoftworks.nxt.sdPlugin/bin/plugin.js: an installed plugin has no
// node_modules. The Convex URL and dashboard origin are baked in from the
// environment (the repo's .env through `pnpm with-env`).

const sdPlugin = 'dev.zedsoftworks.nxt.sdPlugin'
const isWatching = Boolean(process.env.ROLLUP_WATCH)
const root = path.dirname(fileURLToPath(import.meta.url))

// `--environment RELEASE` (the package script) refuses a build that would
// ship without a server or with localhost pairing links.
const isRelease = Boolean(process.env.RELEASE)

/** An env var, with an empty value treated as unset. */
function env(name) {
    const value = process.env[name]?.trim()
    return value ? value : undefined
}

function missing(message) {
    if (isRelease) throw new Error(`${message} A release build needs it.`)
    console.warn(message)
}

const convexUrl = env('CONVEX_URL') ?? env('NEXT_PUBLIC_CONVEX_URL') ?? ''
if (convexUrl === '') {
    missing(
        'CONVEX_URL (or NEXT_PUBLIC_CONVEX_URL) is not set: the plugin will stay offline.'
    )
}
const dashboardUrl = env('DASHBOARD_URL') ?? 'http://localhost:3000'
if (env('DASHBOARD_URL') === undefined) {
    missing(
        'DASHBOARD_URL is not set: pairing links will point at http://localhost:3000.'
    )
}
if (isRelease && new URL(dashboardUrl).hostname === 'localhost') {
    throw new Error(
        `DASHBOARD_URL is ${dashboardUrl}: a release build needs the production dashboard.`
    )
}

/** @type {import('rollup').RollupOptions} */
export default {
    input: 'src/plugin.ts',
    output: {
        file: `${sdPlugin}/bin/plugin.js`,
        format: 'es',
        sourcemap: isWatching,
        sourcemapPathTransform: (relativeSourcePath, sourcemapPath) =>
            path.relative(
                root,
                path.resolve(path.dirname(sourcemapPath), relativeSourcePath)
            ),
    },
    plugins: [
        {
            name: 'watch-externals',
            buildStart() {
                this.addWatchFile(`${sdPlugin}/manifest.json`)
            },
        },
        {
            // The `~/` path alias from tsconfig.json.
            name: 'tilde-alias',
            resolveId(source) {
                if (!source.startsWith('~/')) return null
                return path.resolve(root, 'src', `${source.slice(2)}.ts`)
            },
        },
        replace({
            preventAssignment: true,
            values: {
                __NXT_CONVEX_URL__: JSON.stringify(convexUrl),
                __NXT_DASHBOARD_URL__: JSON.stringify(dashboardUrl),
            },
        }),
        // Transpile only; `pnpm typecheck` checks types. Workspace packages
        // ship TypeScript sources, so they go through here too.
        esbuild({ target: 'node24', include: /\.ts$/, exclude: [] }),
        nodeResolve({
            browser: false,
            exportConditions: ['node'],
            preferBuiltins: true,
            extensions: ['.ts', '.mjs', '.js', '.json'],
        }),
        commonjs(),
        !isWatching && terser(),
        {
            name: 'emit-module-package-file',
            generateBundle() {
                this.emitFile({
                    fileName: 'package.json',
                    source: `{ "type": "module" }`,
                    type: 'asset',
                })
            },
        },
    ],
}
