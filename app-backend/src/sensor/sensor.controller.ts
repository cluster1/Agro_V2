import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SensorService } from './sensor.service';
import { CreateSensorDto } from './dto/create-sensor.dto';
import { UpdateSensorDto } from './dto/update-sensor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AdminWrite } from '../common/decorators/admin-write.decorator';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@ApiTags('sensors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller()
export class SensorController {
  constructor(private readonly sensorService: SensorService) {}

  @AdminWrite()
  @Post('sensors')
  @ApiOperation({ summary: 'Create new sensor' })
  @ApiResponse({ status: 201, description: 'Sensor created successfully' })
  create(
    @TenantId() tenantId: string,
    @Body() createSensorDto: CreateSensorDto,
  ) {
    return this.sensorService.create(tenantId, createSensorDto);
  }

  @Get('devices/:deviceId/sensors')
  @ApiOperation({ summary: 'Get all sensors for device' })
  @ApiResponse({ status: 200, description: 'List of sensors' })
  findAll(
    @TenantId() tenantId: string,
    @Param('deviceId') deviceId: string,
  ) {
    return this.sensorService.findAll(deviceId, tenantId);
  }

  @Get('devices/:deviceId/sensors/:id')
  @ApiOperation({ summary: 'Get sensor by ID with device validation' })
  @ApiResponse({ status: 200, description: 'Sensor details' })
  findOneWithDevice(
    @Param('deviceId') deviceId: string,
    @Param('id') id: string,
    @TenantScope() scope: string | undefined,
  ) {
    return this.sensorService.findOne(id, deviceId, scope);
  }

  @AdminWrite()
  @Patch('devices/:deviceId/sensors/:id')
  @ApiOperation({ summary: 'Update sensor' })
  @ApiResponse({ status: 200, description: 'Sensor updated successfully' })
  update(
    @Param('deviceId') deviceId: string,
    @Param('id') id: string,
    @Body() updateSensorDto: UpdateSensorDto,
    @TenantScope() scope: string | undefined,
  ) {
    return this.sensorService.update(id, deviceId, updateSensorDto, scope);
  }

  @AdminWrite()
  @Delete('devices/:deviceId/sensors/:id')
  @ApiOperation({ summary: 'Delete sensor' })
  @ApiResponse({ status: 200, description: 'Sensor deleted successfully' })
  remove(
    @Param('deviceId') deviceId: string,
    @Param('id') id: string,
    @TenantScope() scope: string | undefined,
  ) {
    return this.sensorService.remove(id, deviceId, scope);
  }
}
