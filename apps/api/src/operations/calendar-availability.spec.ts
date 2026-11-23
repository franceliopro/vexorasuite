import { bookCalendarSlot } from "./calendar-availability";
import type { GoogleAccessService } from "./google-access.service";

describe("Chatbot calendar booking", () => {
  const access = { token: async () => "test-token" } as unknown as GoogleAccessService;
  const from = new Date("2030-01-01T15:00:00Z");
  const to = new Date("2030-01-01T15:30:00Z");
  const book = () => bookCalendarSlot(access, "tenant", "account", "agenda", from, to, "Atendimento", "same-booking");
  const missing = () => new Response(null, { status: 404 });
  const busy = (occupied: boolean) => Response.json({ calendars: { agenda: { busy: occupied ? [{}] : [] } } });

  afterEach(() => jest.restoreAllMocks());

  it("reports an occupied slot without inserting an event", async () => {
    const request = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(missing()).mockResolvedValueOnce(busy(true));
    await expect(book()).resolves.toBe("ocupado");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("recognizes the same reservation after an uncertain insertion and on retry", async () => {
    const request = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(missing()).mockResolvedValueOnce(busy(false));
    let id = "";
    request.mockImplementationOnce(async (_url, init) => {
      id = JSON.parse(String(init?.body)).id;
      expect(id).toMatch(/^[a-f0-9]{64}$/);
      throw new Error("connection lost");
    });
    request.mockImplementation(async url => {
      expect(String(url)).toContain("/events/" + id);
      return Response.json({ id, status: "confirmed" });
    });
    await expect(book()).resolves.toBe("confirmado");
    await expect(book()).resolves.toBe("confirmado");
    expect(request.mock.calls.filter(([url, init]) => String(url).endsWith("/events") && init?.method === "POST")).toHaveLength(1);
  });

  it("does not report confirmation when the event is missing after insertion", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(missing()).mockResolvedValueOnce(busy(false))
      .mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(missing());
    await expect(book()).resolves.toBe("indisponível");
  });
});
