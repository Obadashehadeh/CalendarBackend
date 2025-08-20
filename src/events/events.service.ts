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
    console.log('🎯 EventsService.createEvent called');
    console.log('📝 Event data:', createEventDto);
    console.log('🔑 Access token received:', accessToken ? 'YES' : 'NO');
    console.log('🔑 Token value:', accessToken);

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

    console.log('💾 Saving to Firebase...');
    const docRef = await eventsCollection.add(event);
    console.log('✅ Saved to Firebase with ID:', docRef.id);

    const eventWithId = { ...event, id: docRef.id };

    // Google Calendar sync
    if (accessToken) {
      console.log('🔄 Attempting Google Calendar sync...');
      try {
        console.log('📤 Calling Google Calendar API...');
        const googleEventId = await this.googleCalendarService.createGoogleEvent(
          eventWithId,
          accessToken,
        );
        console.log('✅ Google Calendar event created with ID:', googleEventId);

        await docRef.update({ googleCalendarId: googleEventId });
        eventWithId.googleCalendarId = googleEventId;
        console.log('✅ Updated Firebase with Google Calendar ID');
      } catch (error) {
        console.error('❌ Google Calendar sync failed:', error);
        console.error('❌ Error details:', error.message);
        console.error('❌ Full error:', error);
      }
    } else {
      console.log('⚠️ No access token - skipping Google sync');
    }

    return eventWithId;
  }

  async updateEvent(
    id: string,
    updateEventDto: UpdateEventDto,
    accessToken?: string,
  ): Promise<Event | null> {
    console.log('🔄 EventsService.updateEvent called');
    console.log('📝 Update data:', updateEventDto);
    console.log('🔑 Access token:', accessToken ? 'YES' : 'NO');

    const db = this.firebaseService.getFirestore();
    const docRef = db.collection(this.collectionName).doc(id);

    const doc = await docRef.get();
    if (!doc.exists) {
      console.log('❌ Event not found:', id);
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
    console.log('✅ Updated in Firebase');

    if (currentEvent.googleCalendarId && accessToken) {
      console.log('🔄 Updating in Google Calendar...');
      try {
        const updatedEvent = { ...currentEvent, ...updateData };
        await this.googleCalendarService.updateGoogleEvent(
          currentEvent.googleCalendarId,
          updatedEvent,
          accessToken,
        );
        console.log('✅ Updated in Google Calendar');
      } catch (error) {
        console.error('❌ Google Calendar update failed:', error);
      }
    }

    const updatedDoc = await docRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() } as Event;
  }

  async deleteEvent(id: string, accessToken?: string): Promise<boolean> {
    console.log('🗑️ EventsService.deleteEvent called');
    console.log('🔑 Access token:', accessToken ? 'YES' : 'NO');

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
    console.log('✅ Marked as deleted in Firebase');

    if (event.googleCalendarId && accessToken) {
      console.log('🔄 Deleting from Google Calendar...');
      try {
        await this.googleCalendarService.deleteGoogleEvent(
          event.googleCalendarId,
          accessToken,
        );
        console.log('✅ Deleted from Google Calendar');
      } catch (error) {
        console.error('❌ Google Calendar delete failed:', error);
      }
    }

    return true;
  }

  async syncFromGoogleCalendar(userId: string, accessToken: string): Promise<void> {
    console.log('🔄 Syncing from Google Calendar...');
    console.log('👤 User ID:', userId);
    console.log('🔑 Access token:', accessToken ? 'YES' : 'NO');

    try {
      const googleEvents = await this.googleCalendarService.fetchGoogleEvents(
        accessToken,
        userId,
      );
      console.log('📥 Fetched from Google:', googleEvents.length, 'events');

      const db = this.firebaseService.getFirestore();
      const eventsCollection = db.collection(this.collectionName);

      for (const googleEvent of googleEvents) {
        const existingEvent = await eventsCollection
          .where('googleCalendarId', '==', googleEvent.googleCalendarId)
          .where('userId', '==', userId)
          .get();

        if (existingEvent.empty) {
          console.log('➕ Adding new Google event:', googleEvent.title);
          await eventsCollection.add(googleEvent);
        } else {
          console.log('🔄 Updating existing Google event:', googleEvent.title);
          const existingDoc = existingEvent.docs[0];
          const existingData = existingDoc.data() as Event;

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
      console.log('✅ Google Calendar sync completed');
    } catch (error) {
      console.error('❌ Google Calendar sync failed:', error);
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