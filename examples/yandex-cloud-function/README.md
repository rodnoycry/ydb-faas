# Yandex Cloud Function — `@rodnoycry/ydb-faas` example

A minimal Yandex Cloud Function (TypeScript) demonstrating how to use
[`@rodnoycry/ydb-faas`](../..) to run YDB inside a FaaS handler without
giving up the long-lived-connection coding style in the rest of your code.

## What it does

GET request → echoes the query parameters back as JSON, round-tripped through
YDB via `SELECT ... FROM AS_TABLE(...)`. The point is to show the lifecycle pattern with a real YDB call.

## What to look at

- **`src/index.ts`** — the handler. Owns the driver: creates it on every
  invocation, calls `runWithYdbSql(query(driver), ...)`, closes it in `finally`.
- **`src/service.ts`** — a generic module. Doesn't know about FaaS, doesn't
  receive the driver — just calls `getYdbSql()` when it needs to query.

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
# Allow public access for tests
yc serverless function allow-unauthenticated-invoke yandex-cloud-function-example
```

### 2. Grant the function access to YDB

The function needs a service account with permission to read/write your YDB
database. Inside the function, `EnvironCredentialsProvider` will pick up an
IAM token from Yandex Cloud's metadata endpoint automatically — no env var
required for credentials.

```sh
# Create a service account for the function (one-time)
yc iam service-account create --name=ycf-ydb-faas-example

# Grant it ydb.editor on the folder containing your YDB database
yc resource-manager folder add-access-binding <folder-id> \
    --role=ydb.editor \
    --subject="serviceAccount:<service-account-id>"
```

Then attach the service account to the function in step 4 (the deploy command
needs a `--service-account-id=<id>` flag — add it to `npm run deploy`).

### 3. Set environment variables on the function

In the YC console or by adding `--environment` flags to the deploy command:

```sh
yc serverless function version create --environment YDB_CONNECTION_STRING=...
```

Only `YDB_CONNECTION_STRING` is required at runtime. The credentials env var
from `.env.example` is **only** for local dev — on YCF, auth comes from the
attached service account via the metadata endpoint.

### 4. Deploy

```sh
npm run deploy
```

`esbuild` bundles everything into `dist/index.js` and `yc serverless function
version create` uploads the bundle.

### 5. Test

```sh
curl "https://functions.yandexcloud.net/<function-id>?hello=world&n=42"
```

Expected: `{"hello":"world","n":"42"}`

## License

MIT
