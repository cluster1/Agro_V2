import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceSensor } from './entities/device-sensor.entity';
import { DeviceSensorService } from './device-sensor.service';
import { DeviceSensorController } from './device-sensor.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceSensor])],
  controllers: [DeviceSensorController],
  providers: [DeviceSensorService],
  exports: [TypeOrmModule, DeviceSensorService],
})
export class DeviceSensorModule {}
