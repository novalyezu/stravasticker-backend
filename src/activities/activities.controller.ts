import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ok } from '../common/utils/response';
import { ActivitiesService } from './activities.service';
import { ListActivitiesDto } from './dto/list-activities.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Patch('activities/:id')
  async updateActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') activityId: string,
    @Body() body: UpdateActivityDto,
  ) {
    const updated = await this.activitiesService.updateActivity(
      activityId,
      user.id,
      body,
    );
    return ok(updated, 'Updated');
  }

  @Get('activities/:id')
  async getActivityById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') activityId: string,
  ) {
    const activity = await this.activitiesService.getActivityById(
      activityId,
      user.id,
    );
    return ok(activity, 'OK');
  }

  @Get('me/activities')
  async getMyActivities(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListActivitiesDto,
  ) {
    const result = await this.activitiesService.getMyActivities(user.id, query);
    return ok(result.data, 'OK', result.pagination);
  }
}
