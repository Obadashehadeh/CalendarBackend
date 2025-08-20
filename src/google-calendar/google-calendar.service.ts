import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { Event } from '../events/event.interface';

@Injectable()
export class GoogleCalendarService {
  constructor(private configService: ConfigService) {}

  private toGoogleEvent(event: Event) {
    const googleEvent = {
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

    console.log('🔄 Converting to Google event format:', googleEvent);
    return googleEvent;
  }

  async createGoogleEvent(event: Event, accessToken: string): Promise<string> {
    console.log('🎯 GoogleCalendarService.createGoogleEvent called');
    console.log('📝 Event to create:', {
      title: event.title,
      start: event.startDate.toISOString(),
      end: event.endDate.toISOString()
    });
    console.log('🔑 Access token length:', accessToken.length);

    try {
      console.log('🔐 Setting up OAuth2...');
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      console.log('📅 Creating calendar client...');
      const calendar = google.calendar({ version: 'v3', auth });

      console.log('📤 Sending request to Google Calendar API...');
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: this.toGoogleEvent(event),
      });

      console.log('📥 Google Calendar API response status:', response.status);
      console.log('📥 Google Calendar API response data:', response.data);

      if (!response.data.id) {
        throw new Error('No event ID returned from Google Calendar');
      }

      console.log('✅ Google Calendar event created successfully with ID:', response.data.id);
      return response.data.id;
    } catch (error) {
      console.error('❌ Google Calendar API error:');
      console.error('❌ Error message:', error.message);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error status:', error.status);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Full error object:', error);
      throw error;
    }
  }

  async updateGoogleEvent(googleEventId: string, event: Event, accessToken: string): Promise<void> {
    console.log('🔄 GoogleCalendarService.updateGoogleEvent called');
    console.log('🆔 Google event ID:', googleEventId);

    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth });

      await calendar.events.update({
        calendarId: 'primary',
        eventId: googleEventId,
        requestBody: this.toGoogleEvent(event),
      });

      console.log('✅ Google Calendar event updated successfully');
    } catch (error) {
      console.error('❌ Google Calendar update error:', error);
      throw error;
    }
  }

  async deleteGoogleEvent(googleEventId: string, accessToken: string): Promise<void> {
    console.log('🗑️ GoogleCalendarService.deleteGoogleEvent called');
    console.log('🆔 Google event ID:', googleEventId);

    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth });

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: googleEventId,
      });

      console.log('✅ Google Calendar event deleted successfully');
    } catch (error) {
      console.error('❌ Google Calendar delete error:', error);
      throw error;
    }
  }

  async fetchGoogleEvents(accessToken: string, userId: string): Promise<Event[]> {
    console.log('📥 GoogleCalendarService.fetchGoogleEvents called');
    console.log('👤 User ID:', userId);

    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth });

      console.log('📤 Fetching events from Google Calendar...');
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime',
      });

      console.log('📥 Google Calendar events response status:', response.status);
      console.log('📊 Number of events found:', response.data.items?.length || 0);

      return (
        response.data.items?.map((item) => {
          console.log('🔄 Processing Google event:', item.summary);
          return this.fromGoogleEvent(item, userId);
        }) || []
      );
    } catch (error) {
      console.error('❌ Google Calendar fetch error:', error);
      throw error;
    }
  }

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
}