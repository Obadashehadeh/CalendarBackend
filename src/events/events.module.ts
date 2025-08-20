import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { FirebaseService } from '../firebase/firebase.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';

@Module({
  controllers: [EventsController],
  providers: [EventsService, FirebaseService, GoogleCalendarService],
  exports: [EventsService],
})
export class EventsModule {}