import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { FirebaseService } from '../firebase/firebase.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { WebhookCalendarService } from '../google-calendar/webhook-calendar.service';
import { WebhookController } from '../webhook/webhook.controller';

@Module({
  controllers: [EventsController, WebhookController],
  providers: [EventsService, FirebaseService, GoogleCalendarService, WebhookCalendarService],
  exports: [EventsService, WebhookCalendarService],
})
export class EventsModule {}