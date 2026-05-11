import { getYdbSql } from "@rodnoycry/ydb-faas"
import { Text } from "@ydbjs/value/primitive"

// This module knows nothing about FaaS or driver lifecycles. It just calls
// getYdbSql() at the moment of use — same shape any "long-lived connection"
// library (ORMs, auth adapters, query builders) would have.
export async function echo(payload: unknown): Promise<unknown> {
    const sql = getYdbSql()
    const data = [{ payload: new Text(JSON.stringify(payload)) }]
    const rows = await sql<
        Array<{
            payload: string
        }>
    >`SELECT payload FROM AS_TABLE(${data})`
    const cell = rows[0]?.[0]
    return cell ? JSON.parse(cell.payload) : null
}
