import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppLoggerModule } from './app-logger/app-logger.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { UploadsModule } from './uploads/uploads.module';
import { ActivitiesModule } from './activities/activities.module';
import { OcrModule } from './ocr/ocr.module';
import { HealthModule } from './health/health.module';
import { RequestIdMiddleware } from './common/middlewares/request-id.middleware';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DatabaseModule } from './database/database.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AppLoggerModule,
    DatabaseModule,
    StorageModule,
    AuthModule,
    UsersModule,
    UploadsModule,
    ActivitiesModule,
    OcrModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    LoggingInterceptor,
    ResponseInterceptor,
    AllExceptionsFilter,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
