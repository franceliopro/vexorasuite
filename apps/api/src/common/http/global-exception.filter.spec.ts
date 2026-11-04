import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { GlobalExceptionFilter } from "./global-exception.filter";

describe("GlobalExceptionFilter", () => {
  const runFilter = (exception: unknown, headers: Record<string, string> = {}) => {
    const request = {
      originalUrl: "/api/example?tab=all",
      url: "/api/example",
      header: (name: string) => headers[name] ?? headers[name.toLowerCase()],
    };
    const json = jest.fn();
    const response = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnValue({ json }),
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };

    new GlobalExceptionFilter().catch(exception, host as never);

    return { request, response, json };
  };

  it("preserves the HTTP status and exposes only the safe error contract", () => {
    const result = runFilter(new ForbiddenException({ message: "Acesso negado", providerToken: "secret" }), {
      "x-request-id": "client-request-42",
    });

    expect(result.response.setHeader).toHaveBeenCalledWith("x-request-id", "client-request-42");
    expect(result.response.status).toHaveBeenCalledWith(403);
    expect(result.json).toHaveBeenCalledWith({
      statusCode: 403,
      timestamp: expect.any(String),
      path: "/api/example?tab=all",
      requestId: "client-request-42",
      message: "Acesso negado",
    });
    expect(result.json.mock.calls[0][0]).not.toHaveProperty("providerToken");
  });

  it("joins validation messages into a useful public message", () => {
    const result = runFilter(new BadRequestException({ message: ["email must be an email", "name should not be empty"], error: "Bad Request" }));

    expect(result.response.setHeader).toHaveBeenCalledWith("x-request-id", expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(result.json.mock.calls[0][0]).toMatchObject({
      statusCode: 400,
      message: "email must be an email; name should not be empty",
    });
  });

  it("replaces an unsafe request id and hides unexpected exception details", () => {
    const result = runFilter(new Error("database password=should-not-leak"), {
      "x-request-id": "bad id with spaces",
    });

    expect(result.response.status).toHaveBeenCalledWith(500);
    expect(result.json.mock.calls[0][0]).toMatchObject({
      statusCode: 500,
      path: "/api/example?tab=all",
      message: "Internal server error",
    });
    expect(result.json.mock.calls[0][0]).not.toHaveProperty("details");
    expect(result.response.setHeader).toHaveBeenCalledWith("x-request-id", expect.stringMatching(/^[0-9a-f-]{36}$/));
  });

  it("falls back to a generated request id when the header is absent", () => {
    const result = runFilter(new ForbiddenException("Acesso negado"));

    expect(result.json.mock.calls[0][0].requestId).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
  });
});
