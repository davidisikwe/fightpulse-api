import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ScrapedFighter {
  firstName: string;
  lastName: string;
  nickname?: string;
  weightClass: string;
  country?: string;
  imageUrl?: string;
  // Stats (for completed events)
  wins?: number;
  losses?: number;
  draws?: number;
  noContests?: number;
}

export interface ScrapedFight {
  fighterA: string; // Scraper sends fighter names as strings
  fighterB: string;
  weightClass: string;
  isMainEvent?: boolean;
  isChampionship?: boolean;
  // Results (for completed events)
  winner?: string; // Winner name from scraper
  result?: string; // "loss", "win", etc. from scraper
  round?: string; // Round number as string (can be empty)
  method?: string; // 'KO', 'SUB', 'DEC', 'DQ'
  methodDetail?: string; // Additional method info
}

export interface ScrapedEvent {
  name: string;
  date: string; // "November 01, 2025"
  location: string; // "Las Vegas, Nevada, USA"
  eventUrl: string;
  venue?: string;
  bannerImage?: string;
  fights?: ScrapedFight[]; // Event details with fights
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
      events: { created: 0, updated: 0 },
      fighters: { created: 0, updated: 0 },
      fights: { created: 0, updated: 0 },
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

        // Upsert event
        const dbEvent = await this.upsertEvent({
          name: event.name,
          date: eventDate,
          location,
          city,
          country,
          venue: event.venue,
          bannerImage: event.bannerImage,
          eventUrl: event.eventUrl,
          isCompleted,
        });

        if (dbEvent.wasCreated) {
          results.events.created++;
        } else {
          results.events.updated++;
        }

        // If event has fights, ingest them
        if (event.fights && event.fights.length > 0) {
          for (const fight of event.fights) {
            try {
              // Step 2: Parse fighter names from strings
              const fighterAName = this.parseFighterName(fight.fighterA);
              const fighterBName = this.parseFighterName(fight.fighterB);

              if (!fighterAName || !fighterBName) {
                results.errors.push(
                  `Invalid fighter names in fight: ${fight.fighterA} vs ${fight.fighterB}`,
                );
                continue;
              }

              // Create ScrapedFighter objects from parsed names
              const fighterAData: ScrapedFighter = {
                firstName: fighterAName.firstName,
                lastName: fighterAName.lastName,
                weightClass: fight.weightClass,
                // Scraper doesn't provide other fighter details in fight data
              };

              const fighterBData: ScrapedFighter = {
                firstName: fighterBName.firstName,
                lastName: fighterBName.lastName,
                weightClass: fight.weightClass,
              };

              // Find or create fighters
              const fighterA = await this.findOrCreateFighter(
                fighterAData,
                isCompleted,
              );
              const fighterB = await this.findOrCreateFighter(
                fighterBData,
                isCompleted,
              );

              if (fighterA.wasCreated) results.fighters.created++;
              else if (fighterA.wasUpdated) results.fighters.updated++;

              if (fighterB.wasCreated) results.fighters.created++;
              else if (fighterB.wasUpdated) results.fighters.updated++;

              // Step 3: Map result from scraper format to database format
              const fightResult = this.mapFightResult(
                fight.result,
                fight.winner,
                fight.fighterA,
                fight.fighterB,
              );

              // Parse round safely (handle empty strings)
              const roundEnded =
                fight.round && fight.round.trim()
                  ? parseInt(fight.round.trim(), 10)
                  : undefined;
              // Convert NaN to undefined (Prisma requirement)
              const roundEndedSafe =
                roundEnded !== undefined && isNaN(roundEnded)
                  ? undefined
                  : roundEnded;

              // Upsert fight
              const dbFight = await this.upsertFight({
                eventId: dbEvent.id,
                fighterAId: fighterA.id,
                fighterBId: fighterB.id,
                weightClass: fight.weightClass,
                isMainEvent: fight.isMainEvent ?? false,
                isTitleFight: fight.isChampionship ?? false,
                result: fightResult, // Mapped result
                roundEnded: roundEndedSafe,
                method: fight.method || fight.methodDetail, // Use methodDetail as fallback
              });

              if (dbFight.wasCreated) results.fights.created++;
              else results.fights.updated++;
            } catch (error) {
              results.errors.push(
                `Error processing fight in ${event.name}: ${error.message}`,
              );
              console.error(`Error ingesting fight:`, error);
            }
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
   * Upsert an event in the database
   */
  private async upsertEvent(eventData: {
    name: string;
    date: Date;
    location: string | null;
    city: string | null;
    country: string | null;
    venue?: string;
    bannerImage?: string;
    eventUrl?: string;
    isCompleted: boolean;
  }): Promise<{ id: string; wasCreated: boolean }> {
    if (eventData.eventUrl) {
      const existing = await this.prisma.event.findUnique({
        where: { eventUrl: eventData.eventUrl },
      });

      if (existing) {
        await this.prisma.event.update({
          where: { eventUrl: eventData.eventUrl },
          data: {
            name: eventData.name,
            date: eventData.date,
            location: eventData.location,
            city: eventData.city,
            country: eventData.country,
            venue: eventData.venue,
            bannerImage: eventData.bannerImage,
            promotion: 'UFC',
            isCompleted: eventData.isCompleted,
            updatedAt: new Date(),
          },
        });
        return { id: existing.id, wasCreated: false };
      } else {
        const created = await this.prisma.event.create({
          data: {
            name: eventData.name,
            date: eventData.date,
            location: eventData.location,
            city: eventData.city,
            country: eventData.country,
            venue: eventData.venue,
            bannerImage: eventData.bannerImage,
            promotion: 'UFC',
            eventUrl: eventData.eventUrl,
            isCompleted: eventData.isCompleted,
          },
        });
        return { id: created.id, wasCreated: true };
      }
    } else {
      // Fallback: check by name and date
      const existingEvent = await this.prisma.event.findFirst({
        where: {
          name: eventData.name,
          date: eventData.date,
        },
      });

      if (existingEvent) {
        await this.prisma.event.update({
          where: { id: existingEvent.id },
          data: {
            location: eventData.location,
            city: eventData.city,
            country: eventData.country,
            venue: eventData.venue,
            bannerImage: eventData.bannerImage,
            promotion: 'UFC',
            isCompleted: eventData.isCompleted,
            updatedAt: new Date(),
          },
        });
        return { id: existingEvent.id, wasCreated: false };
      } else {
        const created = await this.prisma.event.create({
          data: {
            name: eventData.name,
            date: eventData.date,
            location: eventData.location,
            city: eventData.city,
            country: eventData.country,
            venue: eventData.venue,
            bannerImage: eventData.bannerImage,
            promotion: 'UFC',
            isCompleted: eventData.isCompleted,
          },
        });
        return { id: created.id, wasCreated: true };
      }
    }
  }

  /**
   * Find or create a fighter in the database
   */
  private async findOrCreateFighter(
    fighterData: ScrapedFighter,
    isCompleted: boolean,
  ): Promise<{ id: string; wasCreated: boolean; wasUpdated: boolean }> {
    const existing = await this.prisma.fighter.findFirst({
      where: {
        firstName: fighterData.firstName,
        lastName: fighterData.lastName,
      },
    });

    if (existing) {
      // Update fighter stats if this is a completed event
      if (isCompleted && fighterData.wins !== undefined) {
        await this.prisma.fighter.update({
          where: { id: existing.id },
          data: {
            nickname: fighterData.nickname || existing.nickname,
            weightClass: fighterData.weightClass,
            country: fighterData.country || existing.country,
            imageUrl: fighterData.imageUrl || existing.imageUrl,
            wins: fighterData.wins,
            losses: fighterData.losses ?? 0,
            draws: fighterData.draws ?? 0,
            noContests: fighterData.noContests ?? 0,
          },
        });
        return { id: existing.id, wasCreated: false, wasUpdated: true };
      }
      return { id: existing.id, wasCreated: false, wasUpdated: false };
    } else {
      const created = await this.prisma.fighter.create({
        data: {
          firstName: fighterData.firstName,
          lastName: fighterData.lastName,
          nickname: fighterData.nickname,
          weightClass: fighterData.weightClass,
          country: fighterData.country,
          imageUrl: fighterData.imageUrl,
          wins: fighterData.wins ?? 0,
          losses: fighterData.losses ?? 0,
          draws: fighterData.draws ?? 0,
          noContests: fighterData.noContests ?? 0,
        },
      });
      return { id: created.id, wasCreated: true, wasUpdated: false };
    }
  }

  /**
   * Upsert a fight in the database
   */
  private async upsertFight(fightData: {
    eventId: string;
    fighterAId: string;
    fighterBId: string;
    weightClass: string;
    isMainEvent: boolean;
    isTitleFight: boolean;
    result?: 'fighter_a_win' | 'fighter_b_win' | 'draw' | 'nc';
    roundEnded?: number;
    method?: string;
  }): Promise<{ id: string; wasCreated: boolean }> {
    // Check if fight already exists (same event, same fighters)
    const existing = await this.prisma.fight.findFirst({
      where: {
        eventId: fightData.eventId,
        fighterAId: fightData.fighterAId,
        fighterBId: fightData.fighterBId,
      },
    });

    if (existing) {
      await this.prisma.fight.update({
        where: { id: existing.id },
        data: {
          weightClass: fightData.weightClass,
          isMainEvent: fightData.isMainEvent,
          isTitleFight: fightData.isTitleFight,
          result: fightData.result,
          roundEnded: fightData.roundEnded,
          method: fightData.method,
        },
      });
      return { id: existing.id, wasCreated: false };
    } else {
      const created = await this.prisma.fight.create({
        data: {
          eventId: fightData.eventId,
          fighterAId: fightData.fighterAId,
          fighterBId: fightData.fighterBId,
          weightClass: fightData.weightClass,
          isMainEvent: fightData.isMainEvent,
          isTitleFight: fightData.isTitleFight,
          result: fightData.result,
          roundEnded: fightData.roundEnded,
          method: fightData.method,
        },
      });
      return { id: created.id, wasCreated: true };
    }
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

  private parseFighterName(
    fighterName: string,
  ): { firstName: string; lastName: string } | null {
    try {
      if (!fighterName || !fighterName.trim()) {
        return null;
      }

      const parts = fighterName.trim().split(/\s+/);

      if (parts.length === 0) {
        return null;
      }

      if (parts.length === 1) {
        // Only one name provided - treat as last name
        return { firstName: '', lastName: parts[0] };
      }

      // First name is first part, last name is everything else
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' '); // Handles "Machado Garry" correctly

      return { firstName, lastName };
    } catch {
      return null;
    }
  }

  /**
   * Map scraper result format to database format
   * Scraper: result="loss", winner="Dan Hooker"
   * Database: result="fighter_a_win" | "fighter_b_win" | "draw" | "nc"
   */
  private mapFightResult(
    result: string | undefined,
    winner: string | undefined,
    fighterA: string,
    fighterB: string,
  ): 'fighter_a_win' | 'fighter_b_win' | 'draw' | 'nc' | undefined {
    if (!result && !winner) {
      return undefined; // No result available
    }

    // Strategy 1: Use winner name to determine (most reliable)
    if (winner) {
      const winnerTrimmed = winner.trim();
      const fighterATrimmed = fighterA.trim();
      const fighterBTrimmed = fighterB.trim();

      if (winnerTrimmed === fighterATrimmed) {
        return 'fighter_a_win'; // Fighter A won
      } else if (winnerTrimmed === fighterBTrimmed) {
        return 'fighter_b_win'; // Fighter B won
      }
    }

    // Strategy 2: Parse result string as fallback
    if (result) {
      const resultLower = result.toLowerCase();
      if (resultLower.includes('draw') || resultLower.includes('tie')) {
        return 'draw';
      }
      if (
        resultLower.includes('nc') ||
        resultLower.includes('no contest') ||
        resultLower.includes('no-contest')
      ) {
        return 'nc';
      }
    }

    return undefined; // Could not determine result
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
