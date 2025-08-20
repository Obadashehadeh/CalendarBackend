import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { Event } from '../events/event.interface';

@Injectable()
export class GoogleCalendarService {
  constructor(private configService: ConfigService) {}

  private toGoogleEvent(event: Event) {
    return {
      summary: event.title,
      description: event.description || '',
      start: {
        dateTime: event.startDate.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: event.endDate.toISOString(),
        timeZone: 'UTC',
      },
    };
  }

  async createGoogleEvent(event: Event, accessToken: string): Promise<string> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth });

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: this.toGoogleEvent(event),
    });

    if (!response.data.id) {
      throw new Error('No event ID returned from Google Calendar');
    }

    return response.data.id;
  }

  async updateGoogleEvent(googleEventId: string, event: Event, accessToken: string): Promise<void> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.update({
      calendarId: 'primary',
      eventId: googleEventId,
      requestBody: this.toGoogleEvent(event),
    });
  }

  async deleteGoogleEvent(googleEventId: string, accessToken: string): Promise<void> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: googleEventId,
    });
  }

  async fetchGoogleEvents(accessToken: string, userId: string): Promise<Event[]> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth });

    // Get events from the past 30 days to now + 90 days
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

    return (
      response.data.items?.map((item) => this.fromGoogleEvent(item, userId)) ||
      []
    );
  }

  private fromGoogleEvent(googleEvent: any, userId: string): Event {
    // Handle different date formats
    let startDate: Date;
    let endDate: Date;

    if (googleEvent.start.dateTime) {
      startDate = new Date(googleEvent.start.dateTime);
    } else if (googleEvent.start.date) {
      // All-day event
      startDate = new Date(googleEvent.start.date + 'T00:00:00');
    } else {
      startDate = new Date();
    }

    if (googleEvent.end.dateTime) {
      endDate = new Date(googleEvent.end.dateTime);
    } else if (googleEvent.end.date) {
      // All-day event
      endDate = new Date(googleEvent.end.date + 'T23:59:59');
    } else {
      endDate = new Date(startDate.getTime() + 3600000); // +1 hour
    }

    return {
      title: googleEvent.summary || 'Untitled',
      description: googleEvent.description || '',
      startDate,
      endDate,
      userId,
      googleCalendarId: googleEvent.id,
      createdAt: new Date(googleEvent.created || Date.now()),
      updatedAt: new Date(googleEvent.updated || Date.now()),
      isDeleted: false,
    };
  }
}