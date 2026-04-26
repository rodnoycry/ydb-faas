import { handler } from "./index"
import { logger } from "./logger"

// Mocked event
const event: Parameters<typeof handler>[0] = {
    httpMethod: "GET",
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: { hello: "world", n: "42" }, // Actual passed data
    multiValueQueryStringParameters: {},
    requestContext: {
        identity: { sourceIp: "127.0.0.1", userAgent: "local" },
        httpMethod: "GET",
        requestId: "local",
        requestTime: new Date().toISOString(),
        requestTimeEpoch: Date.now(),
    },
    body: "",
    isBase64Encoded: false,
}

const context: Parameters<typeof handler>[1] = {
    requestId: "local",
    functionName: "ycf-typescript",
    functionVersion: "local",
    memoryLimitInMB: "128",
    getRemainingTimeInMillis: () => 3000,
    getPayload: () => ({}),
}

Promise.resolve(handler(event, context))
    .then((res) => logger.log(JSON.stringify(res, null, 2)))
    .catch(logger.error)
