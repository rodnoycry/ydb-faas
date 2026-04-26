# @rodnoycry/ydb-faas

Run YDB inside FaaS handlers (AWS Lambda, Yandex Cloud Functions, Vercel Functions) without giving up libraries that expect a long-lived database connection.

## Why this exists

YDB's [official guidance](https://github.com/ydb-platform/ydb-js-sdk) for FaaS environments is **do not reuse a `Driver` between invocations**. HTTP/2 connections held across frozen process states cause intermittent timeouts and hangs. The driver must be created inside the handler and closed in `finally`.

That collides with how most database-consuming code is written — initialized once at module scope with a stable connection it can call into for the lifetime of the process. ORMs, query builders, repository layers, auth libraries, custom services: the standard pattern everywhere else assumes one connection lives for the lifetime of one process.

In FaaS with YDB, you have two lifetimes that don't match:

- **Your service / library** wants to live for the lifetime of the process (warm-start friendly).
- **The YDB `Driver`** must live for the lifetime of one invocation.

This package bridges them with `AsyncLocalStorage`: the consumer reads the driver from ambient context per call; the handler creates a fresh driver, binds it to the context, runs the work, and closes the driver when done. Your service code stays written for "normal" lifetimes; the FaaS-specific dance happens once, in your handler.

## Install

```sh
pnpm add @rodnoycry/ydb-faas
# peer deps (you almost certainly already have these)
pnpm add @ydbjs/core @ydbjs/auth @ydbjs/query
```

## Usage

### Wrap your handler

```ts
import { Driver } from "@ydbjs/core"
import { EnvironCredentialsProvider } from "@ydbjs/auth/environ"
import { query } from "@ydbjs/query"
import { runWithYdb } from "@rodnoycry/ydb-faas"
import { service } from "./service" // built once at module scope

export async function handler(event: unknown) {
    const driver = new Driver(process.env.YDB_CONNECTION_STRING!, {
        credentialsProvider: new EnvironCredentialsProvider(),
    })
    try {
        await driver.ready()
        return await runWithYdb(query(driver), () => service.handle(event))
    } finally {
        await driver.close()
    }
}
```

The driver lives inside the handler (per YDB's FaaS guidance). Your service stays at module scope. `runWithYdb` makes the per-invocation driver reachable from inside the service for the duration of the call.

### Read the driver from anywhere downstream

```ts
import { getYdb } from "@rodnoycry/ydb-faas"

export async function findUser(id: string) {
    const sql = getYdb()
    const [user] = await sql`SELECT * FROM users WHERE id = ${id}`
    return user
}
```

`getYdb()` throws if called outside `runWithYdb()`. Use `tryGetYdb()` if the same code path may run both inside and outside a request scope.

### Non-FaaS use

If you're on a long-running server (VPS, Cloud Run, Fargate, Yandex Serverless Containers), you don't need this package — the driver lifetime matches the process lifetime, and you can just pass `query(driver)` directly. This bridge is only useful when the driver must be shorter-lived than the code consuming it.

## API

### `runWithYdb(sql, fn)`

```ts
function runWithYdb<T>(sql: QueryFn, fn: () => Promise<T>): Promise<T>
```

Binds `sql` to async-local storage for the duration of `fn`. Returns whatever `fn` resolves to. Nested calls shadow the outer binding inside their scope.

### `getYdb()`

```ts
function getYdb(): QueryFn
```

Returns the `QueryFn` bound by the enclosing `runWithYdb()`. Throws if called outside of one.

### `tryGetYdb()`

```ts
function tryGetYdb(): QueryFn | undefined
```

Same as `getYdb()` but returns `undefined` instead of throwing.

### `QueryFn`

```ts
type QueryFn = ReturnType<typeof import("@ydbjs/query").query>
```

The type of a `query(driver)` result. Re-exported for convenience.

## Runtime support

- **Node.js** 20.19+ — required for stable `AsyncLocalStorage`.
- **Cloudflare Workers** — supported with the `nodejs_compat` compatibility flag enabled.
- **Other edge runtimes** — verify `node:async_hooks` availability.

## License

MIT
