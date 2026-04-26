import type { query } from "@ydbjs/query"
import { AsyncLocalStorage } from "node:async_hooks"

export type QueryFn = ReturnType<typeof query>

// Inspired by Hono context storage middleware
// https://github.com/honojs/hono/blob/main/src/middleware/context-storage/index.ts
// More on asynchronous context tracking: https://nodejs.org/api/async_context.html#asynchronous-context-tracking
const queryStorage = new AsyncLocalStorage<QueryFn>()

/**
 * Runs a callback with the given QueryFn bound to async-local storage.
 * Anything inside the callback can reach it via getYdb() / tryGetYdb().
 */
export function runWithYdb<T>(sql: QueryFn, fn: () => Promise<T>): Promise<T> {
    return queryStorage.run(sql, fn)
}

/**
 * Get the current request-scoped QueryFn.
 * Returns undefined if called outside of runWithYdb().
 */
export function tryGetYdb(): QueryFn | undefined {
    return queryStorage.getStore()
}

/**
 * Get the current request-scoped QueryFn.
 * Throws if called outside of runWithYdb().
 */
export function getYdb(): QueryFn {
    const sql = tryGetYdb()
    if (!sql) {
        throw new Error(
            "YDB query context is not available. Wrap your handler in runWithYdb().",
        )
    }
    return sql
}
