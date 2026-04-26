import type { QueryClient } from "@ydbjs/query"
import { describe, expect, test } from "vitest"
import { getYdb, runWithYdb, tryGetYdb } from "./index"

// A stand-in for a real QueryClient — we only care about identity for these tests.
const mockSql = (() => {}) as unknown as QueryClient

describe("tryGetYdb", () => {
    test("returns undefined outside of runWithYdb", () => {
        expect(tryGetYdb()).toBeUndefined()
    })

    test("returns the bound sql inside runWithYdb", async () => {
        await runWithYdb(mockSql, async () => {
            expect(tryGetYdb()).toBe(mockSql)
        })
    })

    test("returns undefined again after runWithYdb resolves", async () => {
        await runWithYdb(mockSql, async () => {})
        expect(tryGetYdb()).toBeUndefined()
    })
})

describe("getYdb", () => {
    test("throws outside of runWithYdb", () => {
        expect(() => getYdb()).toThrow(/YDB query context is not available/)
    })

    test("returns the bound sql inside runWithYdb", async () => {
        await runWithYdb(mockSql, async () => {
            expect(getYdb()).toBe(mockSql)
        })
    })
})

describe("runWithYdb", () => {
    test("propagates context across awaits", async () => {
        await runWithYdb(mockSql, async () => {
            await Promise.resolve()
            await new Promise((r) => setTimeout(r, 0))
            expect(getYdb()).toBe(mockSql)
        })
    })

    test("returns the callback's resolved value", async () => {
        const result = await runWithYdb(mockSql, async () => 42)
        expect(result).toBe(42)
    })

    test("supports sync callbacks", () => {
        const result = runWithYdb(mockSql, () => getYdb())
        expect(result).toBe(mockSql)
    })

    test("nested calls shadow the outer sql", async () => {
        const innerSql = (() => {}) as unknown as QueryClient
        await runWithYdb(mockSql, async () => {
            expect(getYdb()).toBe(mockSql)
            await runWithYdb(innerSql, async () => {
                expect(getYdb()).toBe(innerSql)
            })
            expect(getYdb()).toBe(mockSql)
        })
    })
})
