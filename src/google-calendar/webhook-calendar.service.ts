import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

interface ChannelInfo {
  channelId: string;
  resourceId: string;
  expiration: number;
  accessToken: string;
}

@Injectable()
export class WebhookCalendarService {
  private readonly logger = new Logger(WebhookCalendarService.name);
  private readonly webhookSecret = process.env.WEBHOOK_SECRET || 'fallback-secret-123';

  constructor(private configService: ConfigService) {}

  async setupCalendarWatch(accessToken: string, userId: string): Promise<string> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth });

      const channelId = uuidv4();
      const webhookUrl = `${this.getBaseUrl()}/webhook/calendar/${userId}`;
      const expirationTime = Date.now() + (7 * 24 * 60 * 60 * 1000);

      this.logger.log(`Setting up calendar watch for user: ${userId}`);
      this.logger.log(`Webhook URL: ${webhookUrl}`);
      this.logger.log(`Channel ID: ${channelId}`);

      const watchRequest = {
        calendarId: 'primary',
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          token: this.webhookSecret,
          expiration: expirationTime.toString(),
        },
      };

      const response = await calendar.events.watch(watchRequest);

      this.logger.log(`Calendar watch setup successful. Resource ID: ${response.data?.resourceId}`);

      this.storeChannelInfo(userId, {
        channelId,
        resourceId: response.data?.resourceId || '',
        expiration: expirationTime,
        accessToken,
      });

      return channelId;
    } catch (error: any) {
      this.logger.error(`Failed to setup calendar watch: ${error.message}`);
      throw error;
    }
  }

  async handleWebhookNotification(
    userId: string,
    headers: any,
    eventService: any,
  ): Promise<void> {
    try {
      const channelId = headers['x-goog-channel-id'];
      const channelToken = headers['x-goog-channel-token'];
      const resourceState = headers['x-goog-resource-state'];

      this.logger.log(`Webhook received for user: ${userId}`);
      this.logger.log(`Channel ID: ${channelId}`);
      this.logger.log(`Resource State: ${resourceState}`);

      if (channelToken !== this.webhookSecret) {
        throw new Error('Invalid webhook token');
      }

      if (resourceState === 'sync') {
        this.logger.log('Sync message received - webhook setup confirmed');
        return;
      }

      if (resourceState === 'exists' || resourceState === 'not_exists') {
        this.logger.log('Calendar change detected - triggering sync');

        const channelInfo = this.getChannelInfo(userId, channelId);

        if (channelInfo?.accessToken) {
          await eventService.syncFromGoogleCalendar(userId, channelInfo.accessToken);
          this.logger.log('Calendar sync completed');
        } else {
          this.logger.warn('No access token found for user - cannot sync');
        }
      }
    } catch (error: any) {
      this.logger.error(`Webhook handling failed: ${error.message}`);
      throw error;
    }
  }

  private getBaseUrl(): string {
    if (process.env.NODE_ENV === 'development') {
      return process.env.WEBHOOK_BASE_URL || 'https://your-ngrok-url.ngrok.io';
    }

    return process.env.WEBHOOK_BASE_URL || 'https://your-production-domain.com';
  }

  private channelStore = new Map<string, ChannelInfo>();

  private storeChannelInfo(userId: string, channelInfo: ChannelInfo): void {
    const key = `${userId}-${channelInfo.channelId}`;
    this.channelStore.set(key, channelInfo);
    this.logger.log(`Stored channel info for ${key}`);
  }

  private getChannelInfo(userId: string, channelId: string): ChannelInfo | undefined {
    const key = `${userId}-${channelId}`;
    return this.channelStore.get(key);
  }

  async getAllChannelsForUser(userId: string): Promise<ChannelInfo[]> {
    const channels: ChannelInfo[] = [];
    for (const [key, value] of this.channelStore.entries()) {
      if (key.startsWith(userId + '-')) {
        channels.push(value);
      }
    }
    return channels;
  }

  async stopCalendarWatch(channelId: string, resourceId: string, accessToken: string): Promise<void> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth });

      await calendar.channels.stop({
        requestBody: {
          id: channelId,
          resourceId: resourceId,
        },
      });

      this.logger.log(`Stopped calendar watch for channel: ${channelId}`);
    } catch (error: any) {
      this.logger.error(`Failed to stop calendar watch: ${error.message}`);
      throw error;
    }
  }

  async cleanupExpiredChannels(): Promise<void> {
    const now = Date.now();
    const expiredChannels: { key: string; channelInfo: ChannelInfo }[] = [];

    for (const [key, channelInfo] of this.channelStore.entries()) {
      if (channelInfo.expiration && channelInfo.expiration < now) {
        expiredChannels.push({ key, channelInfo });
      }
    }

    for (const { key, channelInfo } of expiredChannels) {
      try {
        await this.stopCalendarWatch(
          channelInfo.channelId,
          channelInfo.resourceId,
          channelInfo.accessToken,
        );
        this.channelStore.delete(key);
        this.logger.log(`Cleaned up expired channel: ${channelInfo.channelId}`);
      } catch (error: any) {
        this.logger.error(`Failed to cleanup channel ${channelInfo.channelId}: ${error.message}`);
      }
    }
  }
}