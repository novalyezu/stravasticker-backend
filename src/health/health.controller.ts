import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  async getHealth() {
    await this.databaseService.ping();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
