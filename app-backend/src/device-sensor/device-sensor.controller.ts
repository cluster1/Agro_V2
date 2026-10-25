import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { DeviceSensorService } from './device-sensor.service';
import { CreateDeviceSensorDto } from './dto/create-device-sensor.dto';
import { UpdateDeviceSensorDto } from './dto/update-device-sensor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AdminWrite } from '../common/decorators/admin-write.decorator';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';

@ApiTags('parameters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller()
export class DeviceSensorController {
  constructor(private readonly deviceSensorService: DeviceSensorService) {}

  @AdminWrite()
  @Post('tenants/:tenantId/devices/:devId/sensors/:sensId/parameters')
  @ApiOperation({ summary: 'Create new parameter for sensor' })
  @ApiResponse({ status: 201, description: 'Parameter created successfully' })
  create(
    @Param('tenantId') tenantId: string,
    @Param('devId') devId: string,
    @Param('sensId') sensId: string,
    @Body() createDeviceSensorDto: CreateDeviceSensorDto,
  ) {
    return this.deviceSensorService.create(
      tenantId,
      sensId,
      devId,
      createDeviceSensorDto,
    );
  }

  @Get('devices/:devId/sensors/:sensId/parameters')
  @ApiOperation({ summary: 'Get all parameters for sensor with device validation' })
  @ApiResponse({ status: 200, description: 'List of parameters' })
  findAllWithDevice(
    @Param('devId') devId: string,
    @Param('sensId') sensId: string,
    @TenantScope() scope: string | undefined,
  ) {
    return this.deviceSensorService.findAll(sensId, devId, scope);
  }

  @Get('sensors/:sensId/parameters')
  @ApiOperation({ summary: 'Get all parameters for sensor' })
  @ApiResponse({ status: 200, description: 'List of parameters' })
  findAll(
    @Param('sensId') sensId: string,
    @TenantScope() scope: string | undefined,
  ) {
    return this.deviceSensorService.findAll(sensId, undefined, scope);
  }

  @Get('devices/:devId/sensors/:sensId/parameters/:id')
  @ApiOperation({ summary: 'Get parameter by ID with composite key validation' })
  @ApiResponse({ status: 200, description: 'Parameter details' })
  findOneWithCompositeKey(
    @Param('devId') devId: string,
    @Param('sensId') sensId: string,
    @Param('id') id: string,
    @TenantScope() scope: string | undefined,
  ) {
    return this.deviceSensorService.findOne(id, devId, sensId, scope);
  }

  @AdminWrite()
  @Patch('devices/:devId/sensors/:sensId/parameters/:id')
  @ApiOperation({ summary: 'Update parameter' })
  @ApiResponse({ status: 200, description: 'Parameter updated successfully' })
  update(
    @Param('devId') devId: string,
    @Param('sensId') sensId: string,
    @Param('id') id: string,
    @Body() updateDeviceSensorDto: UpdateDeviceSensorDto,
    @TenantScope() scope: string | undefined,
  ) {
    return this.deviceSensorService.update(id, devId, sensId, updateDeviceSensorDto, scope);
  }

  @AdminWrite()
  @Delete('devices/:devId/sensors/:sensId/parameters/:id')
  @ApiOperation({ summary: 'Delete parameter' })
  @ApiResponse({ status: 200, description: 'Parameter deleted successfully' })
  remove(
    @Param('devId') devId: string,
    @Param('sensId') sensId: string,
    @Param('id') id: string,
    @TenantScope() scope: string | undefined,
  ) {
    return this.deviceSensorService.remove(id, devId, sensId, scope);
  }
}
