import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ScrapedEvent {
  name: string;
  date: string; // "November 01, 2025"
  location: string; // "Las Vegas, Nevada, USA"
  eventUrl: string;
}

export interface IngestionPayload {
  type: 'completed_events' | 'upcoming_events';
  data: ScrapedEvent[];
}

@Injectable()
export class IngestionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Process and persist scraped events to database
   */
  async ingestEvents(payload: IngestionPayload) {
    const { type, data } = payload;
    const isCompleted = type === 'completed_events';

    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const event of data) {
      try {
        // Parse date from "November 01, 2025" format
        const eventDate = this.parseDate(event.date);
        if (!eventDate) {
          results.errors.push(`Invalid date for event: ${event.name}`);
          continue;
        }

        // Parse location to extract city and country
        const { city, country, location } = this.parseLocation(event.location);

        // Use upsert with eventUrl as unique identifier (if available)
        // Otherwise fall back to name + date
        if (event.eventUrl) {
          const existing = await this.prisma.event.findUnique({
            where: { eventUrl: event.eventUrl },
          });

          if (existing) {
            await this.prisma.event.update({
              where: { eventUrl: event.eventUrl },
              data: {
                name: event.name,
                date: eventDate,
                location,
                city,
                country,
                promotion: 'UFC',
                isCompleted,
                updatedAt: new Date(),
              },
            });
            results.updated++;
          } else {
            await this.prisma.event.create({
              data: {
                name: event.name,
                date: eventDate,
                location,
                city,
                country,
                promotion: 'UFC',
                eventUrl: event.eventUrl,
                isCompleted,
              },
            });
            results.created++;
          }
        } else {
          // Fallback: check by name and date
          const existingEvent = await this.prisma.event.findFirst({
            where: {
              name: event.name,
              date: eventDate,
            },
          });

          if (existingEvent) {
            await this.prisma.event.update({
              where: { id: existingEvent.id },
              data: {
                location,
                city,
                country,
                promotion: 'UFC',
                isCompleted,
                updatedAt: new Date(),
              },
            });
            results.updated++;
          } else {
            await this.prisma.event.create({
              data: {
                name: event.name,
                date: eventDate,
                location,
                city,
                country,
                promotion: 'UFC',
                isCompleted,
              },
            });
            results.created++;
          }
        }
      } catch (error) {
        results.errors.push(`Error processing ${event.name}: ${error.message}`);
        console.error(`Error ingesting event ${event.name}:`, error);
      }
    }

    return {
      success: true,
      type,
      total: data.length,
      ...results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Parse date string like "November 01, 2025" to Date object
   */
  private parseDate(dateString: string): Date | null {
    try {
      // Handle format: "November 01, 2025"
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    } catch {
      return null;
    }
  }

  /**
   * Parse location string like "Las Vegas, Nevada, USA" to extract city and country
   */
  private parseLocation(locationString: string): {
    city: string | null;
    country: string | null;
    location: string | null;
  } {
    if (!locationString) {
      return { city: null, country: null, location: null };
    }

    const parts = locationString.split(',').map((p) => p.trim());

    // Last part is usually country
    const country = parts.length > 0 ? parts[parts.length - 1] : null;

    // First part is usually city
    const city = parts.length > 1 ? parts[0] : null;

    return {
      city: city || null,
      country: country || null,
      location: locationString,
    };
  }
}
