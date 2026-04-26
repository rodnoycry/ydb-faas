import type { QueryClient } from "@ydbjs/query"
import { AsyncLocalStorage } from "node:async_hooks"

// Inspired by Hono context storage middleware
// https://github.com/honojs/hono/blob/main/src/middleware/context-storage/index.ts
// More on asynchronous context tracking: https://nodejs.org/api/async_context.html#asynchronous-context-tracking
const queryStorage = new AsyncLocalStorage<QueryClient>()

/**
 * Creates context for accessing `QueryClient` inside of callback through {@link getYdb} or {@link tryGetYdb}
 *
 * Typically called once per FaaS handler invocation, wrapping all the work that needs database access. The driver itself
 * should be created and closed by the handler (per YDB's FaaS guidance) — this function only handles the
 * publish/lookup half.
 *
 * @example
 * ```ts
 * try {
 *     await driver.ready()
 *     return await runWithYdb(query(driver), () => service.handle(event))
 * } finally {
 *     await driver.close()
 * }
 * ```
 *
 * @see https://github.com/rodnoycry/ydb-faas#readme
 * @see https://github.com/ydb-platform/ydb-js-sdk/tree/main/examples/sls#readme
 */
export function runWithYdb<T>(sql: QueryClient, fn: () => T): T {
    return queryStorage.run(sql, fn)
}

/**
 * Returns the `QueryClient` from {@link runWithYdb} context
 *
 * Code that uses `getYdb()` can be written like any library that expects a
 * long-lived database connection — it just calls `getYdb()` whenever it needs
 * the driver, and the per-invocation lifecycle is arranged at the call site
 * by {@link runWithYdb}.
 *
 * @throws If called outside any `runWithYdb()` scope. Failing loudly is
 *   typically what you want; use {@link tryGetYdb} when the same code path
 *   may run both inside and outside a request scope.
 *
 * @example
 * ```ts
 * async function findUser(id: string) {
 *     const sql = getYdb()
 *     const [user] = await sql`SELECT * FROM users WHERE id = ${id}`
 *     return user
 * }
 * ```
 *
 * @see https://github.com/rodnoycry/ydb-faas#readme
 */
export function getYdb(): QueryClient {
    const sql = tryGetYdb()
    if (!sql) {
        throw new Error(
            "YDB query context is not available. Wrap your handler in runWithYdb().",
        )
    }
    return sql
}

/**
 * Same as {@link getYdb} but returns `undefined` instead of throwing when
 * called outside any `runWithYdb()` scope.
 *
 * Use this when the same code path can legitimately run both inside a request
 * scope (FaaS) and outside one (e.g. a CLI or worker that manages its own
 * driver) — you can branch on the result instead of catching.
 *
 * @example
 * ```ts
 * import type { QueryClient } from "@ydbjs/query"
 * import { tryGetYdb } from "@rodnoycry/ydb-faas"
 *
 * async function findUser(id: string, fallbackSql?: QueryClient) {
 *     const sql = tryGetYdb() ?? fallbackSql
 *     if (!sql) throw new Error("No YDB connection available")
 *     const [user] = await sql`SELECT * FROM users WHERE id = ${id}`
 *     return user
 * }
 * ```
 *
 * @see https://github.com/rodnoycry/ydb-faas#readme
 */
export function tryGetYdb(): QueryClient | undefined {
    return queryStorage.getStore()
}
