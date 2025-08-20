import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { Event } from './event.interface';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
@Injectable()
export class EventsService {
  private readonly collectionName = 'events';

  constructor(private firebaseService: FirebaseService) {}

  async createEvent(createEventDto: CreateEventDto): Promise<Event> {
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

    // Add to Firebase and get the generated ID
    const docRef = await eventsCollection.add(event);

    // Return event with ID
    return {
      ...event,
      id: docRef.id,
    };
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

  async updateEvent(
    id: string,
    updateEventDto: UpdateEventDto,
  ): Promise<Event | null> {
    const db = this.firebaseService.getFirestore();
    const docRef = db.collection(this.collectionName).doc(id);

    // Check if event exists
    const doc = await docRef.get();
    if (!doc.exists) {
      return null;
    }

    // Prepare update data
    const updateData: any = {
      ...updateEventDto,
      updatedAt: new Date(),
    };

    // Convert date strings to Date objects if provided
    if (updateEventDto.startDate) {
      updateData.startDate = new Date(updateEventDto.startDate);
    }
    if (updateEventDto.endDate) {
      updateData.endDate = new Date(updateEventDto.endDate);
    }

    // Update the document
    await docRef.update(updateData);

    // Return updated event
    const updatedDoc = await docRef.get();
    return {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    } as Event;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const db = this.firebaseService.getFirestore();
    const docRef = db.collection(this.collectionName).doc(id);

    // Check if event exists
    const doc = await docRef.get();
    if (!doc.exists) {
      return false;
    }

    // Soft delete - just mark as deleted
    await docRef.update({
      isDeleted: true,
      updatedAt: new Date(),
    });

    return true;
  }

  async hardDeleteEvent(id: string): Promise<boolean> {
    const db = this.firebaseService.getFirestore();
    const docRef = db.collection(this.collectionName).doc(id);

    // Check if event exists
    const doc = await docRef.get();
    if (!doc.exists) {
      return false;
    }

    // Permanently delete
    await docRef.delete();
    return true;
  }
}
