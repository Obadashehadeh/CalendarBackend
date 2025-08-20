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
        // Continue even if Google sync fails
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
        // Continue even if Google sync fails
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
        // Continue even if Google sync fails
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

      // Get all existing events for this user
      const existingSnapshot = await eventsCollection
        .where('userId', '==', userId)
        .get();

      const existingEvents = new Map();
      existingSnapshot.forEach(doc => {
        const data = doc.data() as Event;
        if (data.googleCalendarId) {
          existingEvents.set(data.googleCalendarId, { id: doc.id, ...data });
        }
      });

      // Get current Google Calendar event IDs
      const googleEventIds = new Set(googleEvents.map(e => e.googleCalendarId));

      // Process Google Calendar events
      for (const googleEvent of googleEvents) {
        const existingEvent = existingEvents.get(googleEvent.googleCalendarId);

        if (!existingEvent) {
          // New event from Google - add it
          await eventsCollection.add({
            ...googleEvent,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          // Event exists - check if Google version is newer
          const googleUpdated = googleEvent.updatedAt || new Date(0);
          const localUpdated = existingEvent.updatedAt || new Date(0);

          if (googleUpdated > localUpdated) {
            // Google version is newer - update local
            await eventsCollection.doc(existingEvent.id).update({
              title: googleEvent.title,
              description: googleEvent.description,
              startDate: googleEvent.startDate,
              endDate: googleEvent.endDate,
              updatedAt: new Date(),
              isDeleted: false,
            });
          }
        }
      }

      // Mark events as deleted if they no longer exist in Google Calendar
      for (const [googleCalendarId, localEvent] of existingEvents) {
        if (!googleEventIds.has(googleCalendarId) && !localEvent.isDeleted) {
          await eventsCollection.doc(localEvent.id).update({
            isDeleted: true,
            updatedAt: new Date(),
          });
        }
      }

    } catch (error) {
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