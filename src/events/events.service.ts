import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { Event } from './event.interface';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  private readonly collectionName = 'events';

  constructor(
    private firebaseService: FirebaseService,
    private googleCalendarService: GoogleCalendarService,
  ) {}

  async createEvent(createEventDto: CreateEventDto, accessToken?: string): Promise<Event> {
    const db = this.firebaseService.getFirestore();
    const eventsCollection = db.collection(this.collectionName);

    const event: Event = {
      ...createEventDto,
      startDate: new Date(createEventDto.startDate),
      endDate: new Date(createEventDto.endDate),
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
    };

    const docRef = await eventsCollection.add(event);
    const eventWithId = { ...event, id: docRef.id };

    if (accessToken) {
      try {
        const googleEventId = await this.googleCalendarService.createGoogleEvent(
          eventWithId,
          accessToken,
        );
        await docRef.update({ googleCalendarId: googleEventId });
        eventWithId.googleCalendarId = googleEventId;
      } catch (error) {
        console.error('Failed to sync to Google Calendar:', error);
      }
    }

    return eventWithId;
  }

  async updateEvent(
    id: string,
    updateEventDto: UpdateEventDto,
    accessToken?: string,
  ): Promise<Event | null> {
    const db = this.firebaseService.getFirestore();
    const docRef = db.collection(this.collectionName).doc(id);

    const doc = await docRef.get();
    if (!doc.exists) {
      return null;
    }

    const currentEvent = doc.data() as Event;

    const updateData: any = {
      ...updateEventDto,
      updatedAt: new Date(),
    };

    if (updateEventDto.startDate) {
      updateData.startDate = new Date(updateEventDto.startDate);
    }
    if (updateEventDto.endDate) {
      updateData.endDate = new Date(updateEventDto.endDate);
    }

    await docRef.update(updateData);

    if (currentEvent.googleCalendarId && accessToken) {
      try {
        const updatedEvent = { ...currentEvent, ...updateData };
        await this.googleCalendarService.updateGoogleEvent(
          currentEvent.googleCalendarId,
          updatedEvent,
          accessToken,
        );
      } catch (error) {
        console.error('Failed to sync update to Google Calendar:', error);
      }
    }

    const updatedDoc = await docRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() } as Event;
  }

  async deleteEvent(id: string, accessToken?: string): Promise<boolean> {
    const db = this.firebaseService.getFirestore();
    const docRef = db.collection(this.collectionName).doc(id);

    const doc = await docRef.get();
    if (!doc.exists) {
      return false;
    }

    const event = doc.data() as Event;

    await docRef.update({
      isDeleted: true,
      updatedAt: new Date(),
    });

    if (event.googleCalendarId && accessToken) {
      try {
        await this.googleCalendarService.deleteGoogleEvent(
          event.googleCalendarId,
          accessToken,
        );
      } catch (error) {
        console.error('Failed to delete from Google Calendar:', error);
      }
    }

    return true;
  }

  async syncFromGoogleCalendar(userId: string, accessToken: string): Promise<void> {
    try {
      const googleEvents = await this.googleCalendarService.fetchGoogleEvents(
        accessToken,
        userId,
      );

      const db = this.firebaseService.getFirestore();
      const eventsCollection = db.collection(this.collectionName);

      for (const googleEvent of googleEvents) {
        const existingEvent = await eventsCollection
          .where('googleCalendarId', '==', googleEvent.googleCalendarId)
          .where('userId', '==', userId)
          .get();

        if (existingEvent.empty) {
          await eventsCollection.add(googleEvent);
        } else {
          const existingDoc = existingEvent.docs[0];
          const existingData = existingDoc.data() as Event;

          // Fix: Safe date comparison with fallback
          const googleEventDate = googleEvent.updatedAt || new Date(0);
          const existingEventDate = existingData.updatedAt || new Date(0);

          if (googleEventDate > existingEventDate) {
            await existingDoc.ref.update({
              ...googleEvent,
              updatedAt: new Date(),
            });
          }
        }
      }
    } catch (error) {
      console.error('Error syncing from Google Calendar:', error);
      throw error;
    }
  }

  async findAllEvents(userId: string): Promise<Event[]> {
    try {
      const db = this.firebaseService.getFirestore();
      const eventsCollection = db.collection(this.collectionName);

      const snapshot = await eventsCollection
        .where('userId', '==', userId)
        .where('isDeleted', '==', false)
        .orderBy('startDate', 'asc')
        .get();

      const events: Event[] = [];
      snapshot.forEach((doc) => {
        events.push({
          id: doc.id,
          ...doc.data(),
        } as Event);
      });

      return events;
    } catch (error) {
      console.error('❌ Error in findAllEvents:', error);
      throw error;
    }
  }

  async findEventById(id: string): Promise<Event | null> {
    const db = this.firebaseService.getFirestore();
    const docRef = db.collection(this.collectionName).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    } as Event;
  }
}