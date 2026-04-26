# @rodnoycry/ydb-faas

Run YDB inside FaaS handlers (AWS Lambda, Yandex Cloud Functions, Vercel Functions) without giving up libraries that expect a long-lived database connection.

## Why this exists

YDB's [official guidance for FaaS environments](https://github.com/ydb-platform/ydb-js-sdk/tree/main/examples/sls#readme) is **do not reuse a `Driver` between invocations**. HTTP/2 connections held across frozen process states cause intermittent timeouts and hangs. The driver must be created inside the handler and closed in `finally`.

That collides with how most database-consuming code is written — initialized once at module scope with a stable connection it can call into for the lifetime of the process. ORMs, query builders, auth libraries (e.g. [Better Auth DB adapter](https://better-auth.com/docs/guides/create-a-db-adapter)): the standard pattern everywhere else assumes one connection lives for the lifetime of one process.

In FaaS with YDB, you have two lifetimes that don't match:

- **Your service / library** wants to live for the lifetime of the process (warm-start friendly).
- **The YDB `Driver`** must live for the lifetime of one invocation.

This package bridges them with `AsyncLocalStorage`: the consumer reads the driver from ambient context per call; the handler creates a fresh driver, binds it to the context, runs the work, and closes the driver when done. Your service code stays written for "normal" lifetimes; the FaaS-specific dance happens once, in your handler.

## Install

```sh
npm install @rodnoycry/ydb-faas
# peer deps (you almost certainly already have these)
npm install @ydbjs/core @ydbjs/auth @ydbjs/query
```

## Usage

The pattern is two pieces: you pass callback that uses `getYdb()` (for a deferred lookup) to a service, and then call the service methods within `runWithYdb()` (so `getYdb()` can get the driver from the context):

### 1. Write callback logic using `getYdb()`

```ts
import { getYdb } from "@rodnoycry/ydb-faas"

async function findUser(id: string) {
    const sql = getYdb()
    const [user] = await sql`SELECT * FROM users WHERE id = ${id}`
    return user
}

// Service here - just some third party module
export const service = {
    async handle(event: { userId: string }) {
        return await findUser(event.userId)
    },
}
```

### 2. Wrap your handler with `runWithYdb()`

```ts
import { Driver } from "@ydbjs/core"
import { EnvironCredentialsProvider } from "@ydbjs/auth/environ"
import { query } from "@ydbjs/query"
import { runWithYdb } from "@rodnoycry/ydb-faas"
import { service } from "./service"

export async function handler(event: { userId: string }) {
    const driver = new Driver(process.env.YDB_CONNECTION_STRING!, {
        credentialsProvider: new EnvironCredentialsProvider(),
    })
    // We handle lifetime of driver ourselves using try-finally block
    try {
        await driver.ready()
        return await runWithYdb(query(driver), () => service.handle(event))
    } finally {
        await driver.close()
    }
}
```

`getYdb()` is a *deferred lookup*, not a captured reference. Each call asks "what's the driver bound to the current async context right now?" and returns whatever's there. At module load nothing is wired up — `findUser` hasn't decided which driver it'll use, only that it'll use whichever one is current when it actually runs.

The same approach is used in [Hono](https://hono.dev/), reference: https://github.com/honojs/hono/blob/main/src/middleware/context-storage/index.ts

### Non-FaaS use

If you're on a long-running server (VPS, Cloud Run, Fargate, Yandex Serverless Containers), you don't need this package — the driver lifetime matches the process lifetime, and you can just use `query(driver)` everywhere without dancing. This bridge is only useful when the driver must be shorter-lived than the code consuming it.

## API

### `runWithYdb(sql, fn)`

```ts
function runWithYdb<T>(sql: QueryClient, fn: () => T): T
```

Binds `sql` to async-local storage for the duration of `fn`. Returns whatever `fn` returns — sync or async, the type flows through. Nested calls shadow the outer binding inside their scope.

### `getYdb()`

```ts
function getYdb(): QueryClient
```

Returns the `QueryClient` bound by the enclosing `runWithYdb()`. Throws if called outside of one.

### `tryGetYdb()`

```ts
function tryGetYdb(): QueryClient | undefined
```

Same as `getYdb()` but returns `undefined` instead of throwing.

## Runtime support

- **Node.js** 20.19+ — required for stable `AsyncLocalStorage`.
- **Edge runtimes** — verify `node:async_hooks` availability.

## Examples

- [`examples/yandex-cloud-function`](./examples/yandex-cloud-function) — a
  minimal Yandex Cloud Function (TypeScript) wired up end-to-end: handler
  owns the driver, a separate service module uses `getYdb()` ambiently.
  Includes local-testing setup (mocked YCF event) and `yc` CLI deployment
  steps.

## License

MIT
