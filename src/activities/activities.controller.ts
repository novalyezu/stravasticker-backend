import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ok } from '../common/utils/response';
import { ActivitiesService } from './activities.service';
import { ListActivitiesDto } from './dto/list-activities.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@ApiTags('activities')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Patch('activities/:id')
  @ApiOperation({ summary: 'Update a single activity by ID' })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  @ApiOkResponse({ description: 'Updated activity payload' })
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
  @ApiOperation({ summary: 'Get a single activity by ID' })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  @ApiOkResponse({ description: 'Activity detail payload' })
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
  @ApiOperation({ summary: 'List authenticated user activities' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-based)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiOkResponse({ description: 'Paginated activities payload' })
  async getMyActivities(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListActivitiesDto,
  ) {
    const result = await this.activitiesService.getMyActivities(user.id, query);
    return ok(result.data, 'OK', result.pagination);
  }
}
