import { Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { activities } from '../database/schema';
import { ListActivitiesDto } from './dto/list-activities.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async updateActivity(
    activityId: string,
    userId: string,
    dto: UpdateActivityDto,
  ) {
    const existing = await this.databaseService.db.query.activities.findFirst({
      where: and(eq(activities.id, activityId), eq(activities.userId, userId)),
    });

    if (!existing) {
      throw new NotFoundException('Activity not found');
    }

    const nextActivityDate = dto.activityDate
      ? new Date(dto.activityDate)
      : existing.activityDate;
    const now = new Date();

    await this.databaseService.db
      .update(activities)
      .set({
        activityDate: nextActivityDate ?? null,
        distance: dto.distance ?? existing.distance,
        pace: dto.pace ?? existing.pace,
        time: dto.time ?? existing.time,
        statsJson: dto.statsJson ?? existing.statsJson,
        updatedAt: now,
      })
      .where(and(eq(activities.id, activityId), eq(activities.userId, userId)));

    const updated = await this.databaseService.db.query.activities.findFirst({
      where: and(eq(activities.id, activityId), eq(activities.userId, userId)),
    });
    if (!updated) {
      throw new NotFoundException('Updated activity not found');
    }

    return updated;
  }

  async getActivityById(activityId: string, userId: string) {
    const activity = await this.databaseService.db.query.activities.findFirst({
      where: and(eq(activities.id, activityId), eq(activities.userId, userId)),
    });
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }
    return activity;
  }

  async getMyActivities(userId: string, query: ListActivitiesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const [items, totalRows] = await Promise.all([
      this.databaseService.db
        .select()
        .from(activities)
        .where(eq(activities.userId, userId))
        .orderBy(desc(activities.createdAt))
        .limit(limit)
        .offset(offset),
      this.databaseService.db
        .select({ count: count() })
        .from(activities)
        .where(eq(activities.userId, userId)),
    ]);

    const total = totalRows[0]?.count ?? 0;
    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}
