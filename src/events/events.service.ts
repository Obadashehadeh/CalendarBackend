import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { Event } from './event.interface';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
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

    this.logger.log(`Creating event: ${event.title}`);

    const docRef = await eventsCollection.add(event);
    const eventWithId = { ...event, id: docRef.id };

    // Sync with Google Calendar if token provided
    if (accessToken) {
      try {
        this.logger.log(`Syncing new event to Google Calendar: ${event.title}`);
        const googleEventId = await this.googleCalendarService.createGoogleEvent(
          eventWithId,
          accessToken,
        );
        await docRef.update({ googleCalendarId: googleEventId });
        eventWithId.googleCalendarId = googleEventId;
        this.logger.log(`Successfully synced to Google Calendar with ID: ${googleEventId}`);
      } catch (error) {
        this.logger.error(`Failed to sync event to Google Calendar: ${error.message}`);
        // Don't throw error - event is still created locally
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
    this.logger.log(`Updating event: ${currentEvent.title}`);

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

    // Sync with Google Calendar if linked
    if (currentEvent.googleCalendarId && accessToken) {
      try {
        this.logger.log(`Syncing updated event to Google Calendar: ${currentEvent.googleCalendarId}`);
        const updatedEvent = { ...currentEvent, ...updateData, id };
        await this.googleCalendarService.updateGoogleEvent(
          currentEvent.googleCalendarId,
          updatedEvent,
          accessToken,
        );
        this.logger.log(`Successfully updated Google Calendar event`);
      } catch (error) {
        this.logger.error(`Failed to sync update to Google Calendar: ${error.message}`);
        // Don't throw error - local update succeeded
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
    this.logger.log(`Deleting event: ${event.title}`);

    // Mark as deleted instead of actual deletion for sync purposes
    await docRef.update({
      isDeleted: true,
      updatedAt: new Date(),
    });

    // Delete from Google Calendar if linked
    if (event.googleCalendarId && accessToken) {
      try {
        this.logger.log(`Deleting from Google Calendar: ${event.googleCalendarId}`);
        await this.googleCalendarService.deleteGoogleEvent(
          event.googleCalendarId,
          accessToken,
        );
        this.logger.log(`Successfully deleted from Google Calendar`);
      } catch (error) {
        this.logger.error(`Failed to delete from Google Calendar: ${error.message}`);
        // Don't throw error - local deletion succeeded
      }
    }

    return true;
  }

  async syncFromGoogleCalendar(userId: string, accessToken: string): Promise<void> {
    this.logger.log(`Starting Google Calendar sync for user: ${userId}`);

    try {
      // Fetch events from Google Calendar
      const googleEvents = await this.googleCalendarService.fetchGoogleEvents(
        accessToken,
        userId,
      );

      this.logger.log(`Fetched ${googleEvents.length} events from Google Calendar`);

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

      this.logger.log(`Found ${existingEvents.size} existing events with Google Calendar IDs`);

      // Get current Google Calendar event IDs
      const googleEventIds = new Set(googleEvents.map(e => e.googleCalendarId));

      let addedCount = 0;
      let updatedCount = 0;
      let deletedCount = 0;

      // Process Google Calendar events
      for (const googleEvent of googleEvents) {
        const existingEvent = existingEvents.get(googleEvent.googleCalendarId);

        if (!existingEvent) {
          // New event from Google - add it
          await eventsCollection.add({
            ...googleEvent,
            createdAt: new Date(),
            updatedAt: new Date(),
            isDeleted: false,
          });
          addedCount++;
          this.logger.log(`Added new event from Google: ${googleEvent.title}`);
        } else {
          // Event exists - always update to ensure sync
          await eventsCollection.doc(existingEvent.id).update({
            title: googleEvent.title,
            description: googleEvent.description,
            startDate: googleEvent.startDate,
            endDate: googleEvent.endDate,
            updatedAt: new Date(),
            isDeleted: false,
          });
          updatedCount++;
          this.logger.log(`Updated event from Google: ${googleEvent.title}`);
        }
      }

      // Mark events as deleted if they no longer exist in Google Calendar
      for (const [googleCalendarId, localEvent] of existingEvents) {
        if (!googleEventIds.has(googleCalendarId) && !localEvent.isDeleted) {
          await eventsCollection.doc(localEvent.id).update({
            isDeleted: true,
            updatedAt: new Date(),
          });
          deletedCount++;
          this.logger.log(`Marked event as deleted: ${localEvent.title}`);
        }
      }

      this.logger.log(`Sync completed: ${addedCount} added, ${updatedCount} updated, ${deletedCount} deleted`);

    } catch (error) {
      this.logger.error(`Google Calendar sync failed: ${error.message}`);
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
        const data = doc.data();

        if (!data) {
          this.logger.warn(`Document ${doc.id} has no data`);
          return;
        }

        // Convert Firebase timestamps to proper dates
        let startDate = data.startDate;
        let endDate = data.endDate;

        if (startDate && startDate._seconds) {
          startDate = new Date(startDate._seconds * 1000);
        } else if (typeof startDate === 'string') {
          startDate = new Date(startDate);
        }

        if (endDate && endDate._seconds) {
          endDate = new Date(endDate._seconds * 1000);
        } else if (typeof endDate === 'string') {
          endDate = new Date(endDate);
        }

        events.push({
          id: doc.id,
          ...data,
          startDate,
          endDate,
        } as Event);
      });

      this.logger.log(`Retrieved ${events.length} events for user: ${userId}`);
      return events;
    } catch (error) {
      this.logger.error(`Failed to fetch events: ${error.message}`);
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

    const data = doc.data();

    if (!data) {
      this.logger.warn(`Document ${doc.id} exists but has no data`);
      return null;
    }

    // Convert Firebase timestamps to proper dates
    let startDate = data.startDate;
    let endDate = data.endDate;

    if (startDate && startDate._seconds) {
      startDate = new Date(startDate._seconds * 1000);
    } else if (typeof startDate === 'string') {
      startDate = new Date(startDate);
    }

    if (endDate && endDate._seconds) {
      endDate = new Date(endDate._seconds * 1000);
    } else if (typeof endDate === 'string') {
      endDate = new Date(endDate);
    }

    return {
      id: doc.id,
      ...data,
      startDate,
      endDate,
    } as Event;
  }
}