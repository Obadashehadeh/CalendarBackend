import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { FirebaseService } from '../firebase/firebase.service';

@Module({
  controllers: [EventsController],
  providers: [EventsService, FirebaseService],
  exports: [EventsService], // Export so other modules can use it
})
export class EventsModule {}