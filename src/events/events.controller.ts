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
      const event = await this.eventsService.createEvent(createEventDto, accessToken);
      return {
        success: true,
        data: event,
        message: 'Event created successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to create event',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async getAllEvents(@Query('userId') userId: string) {
    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const events = await this.eventsService.findAllEvents(userId);
      return {
        success: true,
        data: events,
        count: events.length,
      };
    } catch (error) {
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
      await this.eventsService.syncFromGoogleCalendar(userId, accessToken);
      return {
        success: true,
        message: 'Events synced from Google Calendar successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to sync from Google Calendar',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}