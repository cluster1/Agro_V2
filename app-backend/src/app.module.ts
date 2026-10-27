import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { UserModule } from './user/user.module';
import { SiteModule } from './site/site.module';
import { ClusterModule } from './cluster/cluster.module';
import { DeviceModule } from './device/device.module';
import { SensorModule } from './sensor/sensor.module';
import { DeviceSensorModule } from './device-sensor/device-sensor.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { UnitModule } from './unit/unit.module';
import { MediaModule } from './media/media.module';
import { ReportModule } from './report/report.module';
import { AlertModule } from './alert/alert.module';
import { RefModule } from './ref/ref.module';
import { PlantModule } from './plant/plant.module';
import { ScheduleModule } from './schedule/schedule.module';
import { ActivityModule } from './activity/activity.module';
import { ObservationModule } from './observation/observation.module';
import { HarvestModule } from './harvest/harvest.module';
import { SoilModule } from './soil/soil.module';
import { WeatherModule } from './weather/weather.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST'),
        port: +configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false, // Set to false in production
        logging: ['error'], // Only log errors, not queries
      }),
      inject: [ConfigService],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 300, // global ceiling; auth routes use stricter @Throttle
    }]),

    // Feature modules
    AuthModule,
    TenantModule,
    UserModule,
    SiteModule,
    ClusterModule,
    DeviceModule,
    SensorModule,
    DeviceSensorModule,
    MonitoringModule,
    UnitModule,
    MediaModule,
    ReportModule,
    AlertModule,
    WeatherModule,
    RefModule,
    PlantModule,
    ScheduleModule,
    ActivityModule,
    ObservationModule,
    HarvestModule,
    SoilModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
