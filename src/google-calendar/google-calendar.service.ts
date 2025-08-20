import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { Event } from '../events/event.interface';

@Injectable()
export class GoogleCalendarService {
  constructor(private configService: ConfigService) {}

  private toGoogleEvent(event: Event) {
    const startDate = event.startDate instanceof Date ? event.startDate : new Date(event.startDate);
    const endDate = event.endDate instanceof Date ? event.endDate : new Date(event.endDate);

    return {
      summary: event.title,
      description: event.description || '',
      start: {
        dateTime: startDate.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'UTC',
      },
    };
  }

  async createGoogleEvent(event: Event, accessToken: string): Promise<string> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth });

      const googleEventData = this.toGoogleEvent(event);

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: googleEventData,
      });

      if (!response.data.id) {
        throw new Error('No event ID returned from Google Calendar');
      }

      return response.data.id;
    } catch (error) {
      throw error;
    }
  }

  async updateGoogleEvent(googleEventId: string, event: Event, accessToken: string): Promise<void> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth });

      const googleEventData = this.toGoogleEvent(event);

      await calendar.events.update({
        calendarId: 'primary',
        eventId: googleEventId,
        requestBody: googleEventData,
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteGoogleEvent(googleEventId: string, accessToken: string): Promise<void> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth });

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: googleEventId,
      });
    } catch (error) {
      throw error;
    }
  }

  async fetchGoogleEvents(accessToken: string, userId: string): Promise<Event[]> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth });

      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 30);

      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 90);

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 1000,
        singleEvents: true,
        orderBy: 'startTime',
        showDeleted: false,
      });

      const events = response.data.items?.map((item) => this.fromGoogleEvent(item, userId)) || [];

      return events;
    } catch (error) {
      throw error;
    }
  }

  private fromGoogleEvent(googleEvent: any, userId: string): Event {
    let startDate: Date;
    let endDate: Date;

    if (googleEvent.start?.dateTime) {
      startDate = new Date(googleEvent.start.dateTime);
    } else if (googleEvent.start?.date) {
      startDate = new Date(googleEvent.start.date + 'T00:00:00.000Z');
    } else {
      startDate = new Date();
    }

    if (googleEvent.end?.dateTime) {
      endDate = new Date(googleEvent.end.dateTime);
    } else if (googleEvent.end?.date) {
      const endDateObj = new Date(googleEvent.end.date);
      endDateObj.setDate(endDateObj.getDate() - 1);
      endDateObj.setHours(23, 59, 59, 999);
      endDate = endDateObj;
    } else {
      endDate = new Date(startDate.getTime() + 3600000);
    }

    if (isNaN(startDate.getTime())) {
      startDate = new Date();
    }

    if (isNaN(endDate.getTime())) {
      endDate = new Date(startDate.getTime() + 3600000);
    }

    const event: Event = {
      title: googleEvent.summary || 'Untitled Event',
      description: googleEvent.description || '',
      startDate,
      endDate,
      userId,
      googleCalendarId: googleEvent.id,
      createdAt: googleEvent.created ? new Date(googleEvent.created) : new Date(),
      updatedAt: googleEvent.updated ? new Date(googleEvent.updated) : new Date(),
      isDeleted: false,
    };

    return event;
  }
}