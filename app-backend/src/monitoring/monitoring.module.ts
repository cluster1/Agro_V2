import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { SensorRead } from './entities/sensor-read.entity';
import { SensorReadUpdate } from './entities/sensor-read-update.entity';
import { Device } from '../device/entities/device.entity';
import { DeviceSensor } from '../device-sensor/entities/device-sensor.entity';
import { Alert } from '../alert/entities/alert.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SensorRead,
      SensorReadUpdate,
      Device,
      DeviceSensor,
      Alert,
    ]),
  ],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
