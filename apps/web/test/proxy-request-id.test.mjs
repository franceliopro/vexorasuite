import assert from "node:assert/strict";
import test from "node:test";
import { applyResponseRequestId, getProxyRequestId, getResponseRequestId } from "../src/lib/proxy-request-id.ts";

test("preserves a safe incoming request id", () => {
  const request = new Request("http://localhost/api/events", { headers: { "x-request-id": "client-42" } });
  assert.equal(getProxyRequestId(request), "client-42");
});

test("generates a request id when the incoming value is unsafe", () => {
  const request = new Request("http://localhost/api/events", { headers: { "x-request-id": "bad id" } });
  assert.match(getProxyRequestId(request), /^[0-9a-f-]{36}$/);
});

test("propagates request id without replacing an SSE response body", async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("data: ready\n\n"));
      controller.close();
    },
  });
  const upstream = new Response(body, { headers: { "content-type": "text/event-stream" } });
  const response = applyResponseRequestId(new Response(upstream.body, { headers: upstream.headers }), "server-42");

  assert.equal(response.headers.get("x-request-id"), "server-42");
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  assert.equal(await response.text(), "data: ready\n\n");
});

test("accepts a safe upstream id and falls back when it is invalid", () => {
  assert.equal(getResponseRequestId(new Headers({ "x-request-id": "upstream-7" }), "request-7"), "upstream-7");
  assert.equal(getResponseRequestId(new Headers({ "x-request-id": "bad id" }), "request-7"), "request-7");
});
