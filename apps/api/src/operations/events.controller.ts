import { Controller, MessageEvent, Req, Sse, UseGuards } from "@nestjs/common";
import { Observable, map } from "rxjs";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { EventsService } from "./events.service";

@Controller()
@UseGuards(AuthGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Sse("events")
  stream(@Req() request: AuthenticatedRequest): Observable<MessageEvent> {
    return this.events.stream(request.user.tenantId).pipe(
      map((event) => ({ type: event.type, data: event.data })),
    );
  }
}
