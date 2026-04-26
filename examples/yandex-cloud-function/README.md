# Yandex Cloud Function — `@rodnoycry/ydb-faas` example

A minimal Yandex Cloud Function (TypeScript) demonstrating how to use
[`@rodnoycry/ydb-faas`](../..) to run YDB inside a FaaS handler without
giving up the long-lived-connection coding style in the rest of your code.

## What it does

GET request → echoes the query parameters back as JSON, round-tripped through
YDB via `SELECT ... FROM AS_TABLE(...)`. The point is to show the lifecycle pattern with a real YDB call.

## What to look at

- **`src/index.ts`** — the handler. Owns the driver: creates it on every
  invocation, calls `runWithYdb(query(driver), ...)`, closes it in `finally`.
- **`src/service.ts`** — a generic module. Doesn't know about FaaS, doesn't
  receive the driver — just calls `getYdb()` when it needs to query.

This is the core pattern: lifecycle at the edge, ambient access in the core.

## Prerequisites

- A YDB database — local (`ydb-local` Docker image) or in Yandex Cloud
- `YDB_CONNECTION_STRING` set in your environment
- For remote DBs: `YDB_ACCESS_TOKEN_CREDENTIALS` (or another credentials env
  var the [`@ydbjs/auth`](https://github.com/ydb-platform/ydb-js-sdk/tree/main/packages/auth#readme)
  `EnvironCredentialsProvider` recognizes)

## Local testing

```sh
cp .env.example .env
# fill in YDB_CONNECTION_STRING (and YDB_ACCESS_TOKEN_CREDENTIALS for remote)
npm install
npm run dev
```

`src/local.ts` mocks a YCF GET event with `?hello=world&n=42` and invokes the
handler. Expected response body:

```json
{ "hello": "world", "n": "42" }
```

## Deployment

### 1. Create the function (one-time)

```sh
yc serverless function create --name=yandex-cloud-function-example
yc serverless function allow-unauthenticated-invoke yandex-cloud-function-example
```

### 2. Set environment variables on the function

In the YC console (or via `yc serverless function version create --environment`),
set `YDB_CONNECTION_STRING` and your credentials env var.

### 3. Deploy

```sh
npm run deploy
```

`esbuild` bundles everything into `dist/index.js` and `yc serverless function
version create` uploads the bundle.

### 4. Test

```sh
curl "https://functions.yandexcloud.net/<function-id>?hello=world&n=42"
```

Expected: `{"hello":"world","n":"42"}`

## License

MIT
