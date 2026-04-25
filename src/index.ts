import { Driver } from "@ydbjs/core"
import { EnvironCredentialsProvider } from "@ydbjs/auth/environ"
import { query } from "@ydbjs/query"
import { AsyncLocalStorage } from "node:async_hooks"
import { Env } from "@/env"

export type QueryFn = ReturnType<typeof query>

function createDriver(): Driver {
    return new Driver(Env.YDB_CONNECTION_STRING, {
        credentialsProvider: new EnvironCredentialsProvider(),
    })
}

// For long running processes
let _driver: Promise<Driver> | null = null

/**
 * Function to execute sql in long running tasks
 */
export async function ydb(): Promise<QueryFn> {
    if (!_driver) {
        _driver = (async () => {
            try {
                const driver = createDriver()
                await driver.ready()
                return driver
            } catch (e) {
                _driver = null
                throw e
            }
        })()
    }
    return query(await _driver)
}

/**
 * Manual lifecycle utility for FaaS (AWS Lambda, Yandex Cloud functions)
 */
export async function createYdbSession() {
    const driver = createDriver()
    await driver.ready()
    return {
        sql: query(driver),
        close: () => driver.close(),
    }
}

/**
 * With handled lifecycle utility for FaaS (AWS Lambda, Yandex Cloud functions)
 */
export async function withYdb<T>(fn: (sql: QueryFn) => Promise<T>): Promise<T> {
    const { sql, close } = await createYdbSession()
    try {
        return await fn(sql)
    } finally {
        close()
    }
}

// Inspired by Hono context storage middleware
// https://github.com/honojs/hono/blob/main/src/middleware/context-storage/index.ts
const ydbStorage = new AsyncLocalStorage<QueryFn>()

/**
 * Runs a callback with a request-scoped YDB session.
 * The session is created before and closed after the callback.
 * Access it anywhere inside via getYdb().
 */
export async function runWithYdb<T>(fn: () => Promise<T>): Promise<T> {
    const { sql, close } = await createYdbSession()
    try {
        return await ydbStorage.run(sql, fn)
    } finally {
        close()
    }
}

/**
 * Get the current request-scoped YDB query function.
 * Returns undefined if called outside of runWithYdb().
 */
export function tryGetYdb(): QueryFn | undefined {
    return ydbStorage.getStore()
}

/**
 * Get the current request-scoped YDB query function.
 * Throws if called outside of runWithYdb().
 */
export function getYdb(): QueryFn {
    const sql = tryGetYdb()
    if (!sql) {
        throw new Error(
            "YDB context is not available. Wrap your handler in runWithYdb().",
        )
    }
    return sql
}
