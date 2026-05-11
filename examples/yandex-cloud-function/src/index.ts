import { EnvironCredentialsProvider } from "@ydbjs/auth/environ"
import { Driver } from "@ydbjs/core"
import { query } from "@ydbjs/query"
import { runWithYdbSql } from "@rodnoycry/ydb-faas"
import type { Handler } from "@yandex-cloud/function-types"
import { echo } from "./service"

export const handler: Handler.Http = async (event, _context) => {
    const connectionString = process.env.YDB_CONNECTION_STRING
    if (!connectionString) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "YDB_CONNECTION_STRING is not set" }),
        }
    }

    // Per YDB FaaS guidance: create driver inside the handler, close in finally.
    const driver = new Driver(connectionString, {
        credentialsProvider: new EnvironCredentialsProvider(),
    })

    try {
        await driver.ready()
        // Here we invoke initialized service method but with driver initialized within scope of invocation
        const result = await runWithYdbSql(query(driver), () =>
            echo(event.queryStringParameters),
        )
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result),
        }
    } finally {
        await driver.close()
    }
}
