import type { QueryClient } from "@ydbjs/query"
import { describe, expect, test } from "vitest"
import { getYdbSql, runWithYdbSql, tryGetYdbSql } from "./index"

// A stand-in for a real QueryClient — we only care about identity for these tests.
const mockSql = (() => {}) as unknown as QueryClient

describe("tryGetYdbSql", () => {
    test("returns undefined outside of runWithYdbSql", () => {
        expect(tryGetYdbSql()).toBeUndefined()
    })

    test("returns the bound sql inside runWithYdbSql", async () => {
        await runWithYdbSql(mockSql, async () => {
            expect(tryGetYdbSql()).toBe(mockSql)
        })
    })

    test("returns undefined again after runWithYdbSql resolves", async () => {
        await runWithYdbSql(mockSql, async () => {})
        expect(tryGetYdbSql()).toBeUndefined()
    })
})

describe("getYdbSql", () => {
    test("throws outside of runWithYdbSql", () => {
        expect(() => getYdbSql()).toThrow(/YDB query context is not available/)
    })

    test("returns the bound sql inside runWithYdbSql", async () => {
        await runWithYdbSql(mockSql, async () => {
            expect(getYdbSql()).toBe(mockSql)
        })
    })
})

describe("runWithYdbSql", () => {
    test("propagates context across awaits", async () => {
        await runWithYdbSql(mockSql, async () => {
            await Promise.resolve()
            await new Promise((r) => setTimeout(r, 0))
            expect(getYdbSql()).toBe(mockSql)
        })
    })

    test("returns the callback's resolved value", async () => {
        const result = await runWithYdbSql(mockSql, async () => 42)
        expect(result).toBe(42)
    })

    test("supports sync callbacks", () => {
        const result = runWithYdbSql(mockSql, () => getYdbSql())
        expect(result).toBe(mockSql)
    })

    test("nested calls shadow the outer sql", async () => {
        const innerSql = (() => {}) as unknown as QueryClient
        await runWithYdbSql(mockSql, async () => {
            expect(getYdbSql()).toBe(mockSql)
            await runWithYdbSql(innerSql, async () => {
                expect(getYdbSql()).toBe(innerSql)
            })
            expect(getYdbSql()).toBe(mockSql)
        })
    })
})
