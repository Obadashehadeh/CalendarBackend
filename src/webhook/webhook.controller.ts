import {
  Controller,
  Post,
  Param,
  Headers,
  HttpStatus,
  HttpException,
  Logger,
  Get,
  Query,
} from '@nestjs/common';
import { WebhookCalendarService } from '../google-calendar/webhook-calendar.service';
import { EventsService } from '../events/events.service';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: WebhookCalendarService,
    private readonly eventsService: EventsService,
  ) {}

  @Post('calendar/:userId')
  async handleCalendarWebhook(
    @Param('userId') userId: string,
    @Headers() headers: any,
  ) {
    try {
      this.logger.log(`Received webhook for user: ${userId}`);
      this.logger.log(`Headers: ${JSON.stringify(headers)}`);

      await this.webhookService.handleWebhookNotification(
        userId,
        headers,
        this.eventsService,
      );

      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`);
      throw new HttpException(
        'Webhook processing failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('setup/:userId')
  async setupWebhook(
    @Param('userId') userId: string,
    @Query('accessToken') accessToken: string,
  ) {
    try {
      if (!accessToken) {
        throw new HttpException(
          'Access token is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Setting up webhook for user: ${userId}`);

      const channelId = await this.webhookService.setupCalendarWatch(
        accessToken,
        userId,
      );

      return {
        success: true,
        channelId,
        message: 'Webhook setup successful',
      };
    } catch (error) {
      this.logger.error(`Webhook setup failed: ${error.message}`);
      throw new HttpException(
        `Webhook setup failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('status/:userId')
  async getWebhookStatus(@Param('userId') userId: string) {
    try {
      const channels = await this.webhookService.getAllChannelsForUser(userId);

      return {
        success: true,
        userId,
        activeChannels: channels.length,
        channels: channels.map(ch => ({
          channelId: ch.channelId,
          expiration: new Date(ch.expiration),
          isExpired: ch.expiration < Date.now(),
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get webhook status: ${error.message}`);
      throw new HttpException(
        'Failed to get webhook status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('test')
  async testWebhook() {
    return {
      message: 'Webhook endpoint is working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}