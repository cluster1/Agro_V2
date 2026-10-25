import { PartialType } from '@nestjs/swagger';
import { CreateDeviceSensorDto } from './create-device-sensor.dto';

export class UpdateDeviceSensorDto extends PartialType(CreateDeviceSensorDto) {}
