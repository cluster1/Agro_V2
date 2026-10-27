import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { DeviceService } from './device.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AdminWrite } from '../common/decorators/admin-write.decorator';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller()
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @AdminWrite()
  @Post('devices')
  @ApiOperation({ summary: 'Create new device' })
  @ApiResponse({ status: 201, description: 'Device created successfully' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() createDeviceDto: CreateDeviceDto,
  ) {
    return this.deviceService.create(tenantId, user.user_id, createDeviceDto);
  }

  @Get('devices')
  @ApiOperation({ summary: 'Get all devices in tenant' })
  @ApiResponse({ status: 200, description: 'List of devices' })
  findAll(@TenantId() tenantId: string) {
    return this.deviceService.findAll(undefined, tenantId);
  }

  @Get('clusters/:clusterId/devices')
  @ApiOperation({ summary: 'Get all devices in cluster' })
  @ApiResponse({ status: 200, description: 'List of devices' })
  findAllByCluster(
    @Param('clusterId') clusterId: string,
    @TenantScope() scope: string | undefined,
  ) {
    return this.deviceService.findAll(clusterId, scope);
  }

  @Get('clusters/:clusterId/devices/:id')
  @ApiOperation({ summary: 'Get device by ID with cluster validation' })
  @ApiResponse({ status: 200, description: 'Device details' })
  findOneWithCluster(
    @Param('clusterId') clusterId: string,
    @Param('id') id: string,
    @TenantScope() scope: string | undefined,
  ) {
    return this.deviceService.findOne(id, clusterId, scope);
  }

  @Get('devices/:id')
  @ApiOperation({ summary: 'Get device by ID' })
  @ApiResponse({ status: 200, description: 'Device details' })
  findOne(@Param('id') id: string, @TenantScope() scope: string | undefined) {
    return this.deviceService.findOne(id, undefined, scope);
  }

  @AdminWrite()
  @Patch('devices/:id')
  @ApiOperation({ summary: 'Update device' })
  @ApiResponse({ status: 200, description: 'Device updated successfully' })
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() updateDeviceDto: UpdateDeviceDto,
  ) {
    return this.deviceService.update(id, updateDeviceDto, tenantId);
  }

  @AdminWrite()
  @Delete('devices/:id')
  @ApiOperation({ summary: 'Delete device' })
  @ApiResponse({ status: 200, description: 'Device deleted successfully' })
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.deviceService.remove(id, tenantId);
  }
}
