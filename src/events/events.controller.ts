import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  async createEvent(
    @Body() createEventDto: CreateEventDto,
    @Query('accessToken') accessToken?: string,
  ) {
    try {
      console.log('🎯 Controller: Create event called');
      console.log('📝 Request body:', createEventDto);
      console.log('🔑 Access token from query:', accessToken ? 'Present' : 'Missing');
      console.log('🔑 Token value:', accessToken);

      const event = await this.eventsService.createEvent(createEventDto, accessToken);
      return {
        success: true,
        data: event,
        message: 'Event created successfully',
      };
    } catch (error) {
      console.error('❌ Controller error:', error);
      throw new HttpException(
        'Failed to create event',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async getAllEvents(@Query('userId') userId: string) {
    console.log('🚀 GET /events called with userId:', userId);

    if (!userId) {
      console.log('❌ No userId provided');
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const events = await this.eventsService.findAllEvents(userId);
      console.log('✅ Successfully fetched events:', events.length);
      return {
        success: true,
        data: events,
        count: events.length,
      };
    } catch (error) {
      console.error('❌ Controller error:', error);
      throw new HttpException(
        `Failed to fetch events: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getEventById(@Param('id') id: string) {
    try {
      const event = await this.eventsService.findEventById(id);

      if (!event) {
        throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: event,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch event',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  async updateEvent(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @Query('accessToken') accessToken?: string,
  ) {
    try {
      console.log('🎯 Controller: Update event called');
      console.log('🆔 Event ID:', id);
      console.log('📝 Update data:', updateEventDto);
      console.log('🔑 Access token from query:', accessToken ? 'Present' : 'Missing');

      const event = await this.eventsService.updateEvent(id, updateEventDto, accessToken);

      if (!event) {
        throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: event,
        message: 'Event updated successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('❌ Controller error:', error);
      throw new HttpException(
        'Failed to update event',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async deleteEvent(
    @Param('id') id: string,
    @Query('accessToken') accessToken?: string,
  ) {
    try {
      console.log('🎯 Controller: Delete event called');
      console.log('🆔 Event ID:', id);
      console.log('🔑 Access token from query:', accessToken ? 'Present' : 'Missing');

      const deleted = await this.eventsService.deleteEvent(id, accessToken);

      if (!deleted) {
        throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        message: 'Event deleted successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('❌ Controller error:', error);
      throw new HttpException(
        'Failed to delete event',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sync')
  async syncFromGoogle(
    @Query('userId') userId: string,
    @Query('accessToken') accessToken: string,
  ) {
    if (!userId || !accessToken) {
      throw new HttpException(
        'userId and accessToken are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      console.log('🎯 Controller: Sync from Google called');
      console.log('👤 User ID:', userId);
      console.log('🔑 Access token:', accessToken ? 'Present' : 'Missing');

      await this.eventsService.syncFromGoogleCalendar(userId, accessToken);
      return {
        success: true,
        message: 'Events synced from Google Calendar successfully',
      };
    } catch (error) {
      console.error('❌ Sync controller error:', error);
      throw new HttpException(
        'Failed to sync from Google Calendar',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}