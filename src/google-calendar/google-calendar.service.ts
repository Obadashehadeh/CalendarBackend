import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { Event } from '../events/event.interface';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private configService: ConfigService) {}

  private toGoogleEvent(event: Event) {
    // Ensure we have valid Date objects
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
      this.logger.log(`Creating Google Calendar event: ${event.title}`);
      this.logger.debug(`Event data: ${JSON.stringify(googleEventData)}`);

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: googleEventData,
      });

      if (!response.data.id) {
        throw new Error('No event ID returned from Google Calendar');
      }

      this.logger.log(`Created Google Calendar event with ID: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      this.logger.error(`Failed to create Google Calendar event: ${error.message}`);
      if (error.response) {
        this.logger.error(`Google API Error: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async updateGoogleEvent(googleEventId: string, event: Event, accessToken: string): Promise<void> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth });

      const googleEventData = this.toGoogleEvent(event);
      this.logger.log(`Updating Google Calendar event: ${googleEventId}`);
      this.logger.debug(`Event data: ${JSON.stringify(googleEventData)}`);

      await calendar.events.update({
        calendarId: 'primary',
        eventId: googleEventId,
        requestBody: googleEventData,
      });

      this.logger.log(`Updated Google Calendar event: ${googleEventId}`);
    } catch (error) {
      this.logger.error(`Failed to update Google Calendar event ${googleEventId}: ${error.message}`);
      if (error.response) {
        this.logger.error(`Google API Error: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async deleteGoogleEvent(googleEventId: string, accessToken: string): Promise<void> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth });

      this.logger.log(`Deleting Google Calendar event: ${googleEventId}`);

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: googleEventId,
      });

      this.logger.log(`Deleted Google Calendar event: ${googleEventId}`);
    } catch (error) {
      this.logger.error(`Failed to delete Google Calendar event ${googleEventId}: ${error.message}`);
      if (error.response) {
        this.logger.error(`Google API Error: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async fetchGoogleEvents(accessToken: string, userId: string): Promise<Event[]> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth });

      // Get events from the past 30 days to now + 90 days
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 30);

      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 90);

      this.logger.log(`Fetching Google Calendar events from ${timeMin.toISOString()} to ${timeMax.toISOString()}`);

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

      this.logger.log(`Fetched ${events.length} events from Google Calendar`);

      return events;
    } catch (error) {
      this.logger.error(`Failed to fetch Google Calendar events: ${error.message}`);
      if (error.response) {
        this.logger.error(`Google API Error: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  private fromGoogleEvent(googleEvent: any, userId: string): Event {
    // Handle different date formats
    let startDate: Date;
    let endDate: Date;

    // Parse start date
    if (googleEvent.start?.dateTime) {
      startDate = new Date(googleEvent.start.dateTime);
    } else if (googleEvent.start?.date) {
      // All-day event
      startDate = new Date(googleEvent.start.date + 'T00:00:00.000Z');
    } else {
      startDate = new Date();
    }

    // Parse end date
    if (googleEvent.end?.dateTime) {
      endDate = new Date(googleEvent.end.dateTime);
    } else if (googleEvent.end?.date) {
      // All-day event - end date should be the day before at 23:59:59
      const endDateObj = new Date(googleEvent.end.date);
      endDateObj.setDate(endDateObj.getDate() - 1);
      endDateObj.setHours(23, 59, 59, 999);
      endDate = endDateObj;
    } else {
      endDate = new Date(startDate.getTime() + 3600000); // +1 hour default
    }

    // Validate dates
    if (isNaN(startDate.getTime())) {
      this.logger.warn(`Invalid start date for Google event ${googleEvent.id}, using current time`);
      startDate = new Date();
    }

    if (isNaN(endDate.getTime())) {
      this.logger.warn(`Invalid end date for Google event ${googleEvent.id}, using start date + 1 hour`);
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

    this.logger.debug(`Converted Google event: ${event.title} (${startDate.toISOString()} - ${endDate.toISOString()})`);

    return event;
  }
}