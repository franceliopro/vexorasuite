import {Controller,MessageEvent,Req,Sse,UseGuards} from '@nestjs/common';
import {Observable,mergeMap,filter,takeUntil,timer} from 'rxjs';
import {AuthGuard} from '../auth/auth.guard';
import {AuthenticatedRequest} from '../auth/auth.types';
import {EventsAuthorizationService} from './events-authorization.service';
import {EventsService} from './events.service';
@Controller() @UseGuards(AuthGuard)
export class EventsController{
 constructor(private readonly events:EventsService,private readonly authorization:EventsAuthorizationService){}
 @Sse('events') stream(@Req() req:AuthenticatedRequest):Observable<MessageEvent>{
  const expiresAt = typeof (req.user as any).exp === 'number' ? Number((req.user as any).exp) * 1000 : Date.now() + 15 * 60 * 1000;
  const remainingMs = Math.max(1, expiresAt - Date.now());
  return this.events.stream(req.user.tenantId).pipe(takeUntil(timer(remainingMs)),mergeMap(async event=>{
   if(typeof (req.user as any).exp==='number'&&(req.user as any).exp*1000<=Date.now())return null;
   return this.authorization.authorize(req.user,event);
  }, 8),filter((event):event is {type:string;data:Record<string,unknown>}=>event!==null));
 }
}
