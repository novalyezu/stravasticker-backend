import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AppLoggerService } from '../app-logger/app-logger.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly logger: AppLoggerService,
  ) {}

  @Get()
  async getHealth() {
    try {
      await this.databaseService.ping();
    } catch (error) {
      this.logger.error('Health check failed: Database connection error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new InternalServerErrorException('Health check failed: Database connection error');
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
