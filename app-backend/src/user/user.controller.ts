import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminWrite } from '../common/decorators/admin-write.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Caller } from './user.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Global endpoint for admin to get all users
  @Get('users')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get all users (Global Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all users' })
  findAllGlobal() {
    return this.userService.findAllGlobal();
  }

  // Tenant-specific endpoints
  @Post('tenants/:tenantId/users')
  @UseGuards(TenantGuard)
  @AdminWrite()
  @ApiOperation({ summary: 'Create new user in tenant' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(
    @CurrentUser() caller: Caller,
    @Param('tenantId') tenantId: string,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.userService.create(caller, tenantId, createUserDto);
  }

  @Get('tenants/:tenantId/users')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'Get all users in tenant' })
  @ApiResponse({ status: 200, description: 'List of users' })
  findAll(@Param('tenantId') tenantId: string) {
    return this.userService.findAll(tenantId);
  }

  @Get('tenants/:tenantId/users/:id')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.userService.findOne(tenantId, id);
  }

  @Patch('tenants/:tenantId/users/:id')
  @UseGuards(TenantGuard)
  @AdminWrite()
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  update(
    @CurrentUser() caller: Caller,
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(caller, tenantId, id, updateUserDto);
  }

  @Delete('tenants/:tenantId/users/:id')
  @UseGuards(TenantGuard)
  @AdminWrite()
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  remove(
    @CurrentUser() caller: Caller,
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.userService.remove(caller, tenantId, id);
  }
}
