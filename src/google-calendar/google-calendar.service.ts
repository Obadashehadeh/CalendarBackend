import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { Event } from '../events/event.interface';

@Injectable()
export class GoogleCalendarService {
  constructor(private configService: ConfigService) {}

  // Convert our event to Google Calendar format
  private toGoogleEvent(event: Event) {
    return {
      summary: event.title,
      description: event.description,
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

  // Convert Google Calendar event to our format
  private fromGoogleEvent(googleEvent: any, userId: string): Event {
    return {
      title: googleEvent.summary || 'Untitled',
      description: googleEvent.description || '',
      startDate: new Date(googleEvent.start.dateTime || googleEvent.start.date),
      endDate: new Date(googleEvent.end.dateTime || googleEvent.end.date),
      userId,
      googleCalendarId: googleEvent.id,
      createdAt: new Date(googleEvent.created),
      updatedAt: new Date(googleEvent.updated),
      isDeleted: false,
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

    return response.data.id;
  }

  async updateGoogleEvent(
    googleEventId: string,
    event: Event,
    accessToken: string,
  ): Promise<void> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.update({
      calendarId: 'primary',
      eventId: googleEventId,
      requestBody: this.toGoogleEvent(event),
    });
  }

  async deleteGoogleEvent(
    googleEventId: string,
    accessToken: string,
  ): Promise<void> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: googleEventId,
    });
  }

  async fetchGoogleEvents(
    accessToken: string,
    userId: string,
  ): Promise<Event[]> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth });

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (
      response.data.items?.map((item) => this.fromGoogleEvent(item, userId)) ||
      []
    );
  }
}
