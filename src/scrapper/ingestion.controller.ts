import { Controller, Post, Body } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import type { IngestionPayload } from './ingestion.service';

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('events')
  async ingestEvents(@Body() payload: IngestionPayload) {
    try {
      // Validate payload
      if (!payload.type || !payload.data || !Array.isArray(payload.data)) {
        return {
          success: false,
          error: 'Invalid payload. Expected { type: string, data: array }',
          timestamp: new Date().toISOString(),
        };
      }

      if (!['completed_events', 'upcoming_events'].includes(payload.type)) {
        return {
          success: false,
          error:
            'Invalid type. Must be "completed_events" or "upcoming_events"',
          timestamp: new Date().toISOString(),
        };
      }

      const result = await this.ingestionService.ingestEvents(payload);
      return result;
    } catch (error) {
      console.error('Error in ingestion controller:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
