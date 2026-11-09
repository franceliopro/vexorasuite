import { Test } from "@nestjs/testing";
import { EventsAuthorizationService } from "./events-authorization.service";
import { EventsModule } from "./events.module";

describe("EventsModule", () => {
  it("exports EventsAuthorizationService for consuming modules", async () => {
    const module = await Test.createTestingModule({
      imports: [EventsModule],
    }).compile();

    expect(module.get(EventsAuthorizationService)).toBeInstanceOf(EventsAuthorizationService);

    await module.close();
  });
});
