import type { AuthenticatedRequest } from "../auth/auth.types";
import type { PrismaService } from "../prisma/prisma.service";
import type { GoogleAccessService } from "./google-access.service";
import { GoogleCalendarController } from "./google-calendar.controller";

const start = "2026-12-01T14:00:00.000Z";
const end = "2026-12-01T14:30:00.000Z";
const request = { user: { tenantId: "company", sub: "attendant", role: "AGENT" } } as AuthenticatedRequest;

function setup(assigned: boolean) {
  const assignment = jest.fn().mockResolvedValue(assigned ? [{ userId: "attendant" }] : []);
  const token = jest.fn().mockResolvedValue("test-token");
  const db = {
    calendarAssignment: { findMany: assignment },
    departmentMember: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { controller: new GoogleCalendarController(db as unknown as PrismaService, { token } as unknown as GoogleAccessService), token, assignment };
}

describe("Calendar availability", () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    { busy: [], available: true },
    { busy: [{ start, end }], available: false },
  ])("returns only availability for a permitted calendar (%j)", async ({ busy, available }) => {
    const { controller, token, assignment } = setup(true);
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      calendars: { team: { busy, title: "private data" } },
    })));
    await expect(controller.availability(request, "account", "team", start, end)).resolves.toEqual({ available });
    expect(assignment).toHaveBeenCalledWith({ where: { tenantId: "company", accountId: "account", calendarId: "team" } });
    expect(token).toHaveBeenCalledWith("company", "account", "calendar");
    expect(fetchMock).toHaveBeenCalledWith("https://www.googleapis.com/calendar/v3/freeBusy", expect.objectContaining({ method: "POST" }));
  });

  it("checks assignment before accessing Google", async () => {
    const { controller, token } = setup(false);
    await expect(controller.availability(request, "account", "team", start, end)).rejects.toThrow("não foi atribuída");
    expect(token).not.toHaveBeenCalled();
  });

  it("does not interpret a provider error as an available interval", async () => {
    const { controller } = setup(true);
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      calendars: { team: { errors: [{ reason: "notFound" }] } },
    })));
    await expect(controller.availability(request, "account", "team", start, end)).rejects.toThrow("confirmar a disponibilidade");
  });
});
