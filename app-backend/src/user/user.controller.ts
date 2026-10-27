import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AdminWrite } from '../common/decorators/admin-write.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Caller } from './user.service';
import { isGlobalAdmin } from '../common/constants/roles';
import { SelectedTenant, TenantId } from '../common/decorators/tenant-id.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('users')
  @UseGuards(TenantGuard)
  @AdminWrite()
  @ApiOperation({ summary: 'Create new user in tenant' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(
    @CurrentUser() caller: Caller,
    @TenantId() tenantId: string,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.userService.create(caller, tenantId, createUserDto);
  }

  @Get('users')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'Get users in tenant (global admin without X-Tenant-Id: all users)' })
  @ApiResponse({ status: 200, description: 'List of users' })
  findAll(
    @CurrentUser() caller: Caller,
    @SelectedTenant() selected: string | undefined,
    @TenantId() tenantId: string,
  ) {
    if (isGlobalAdmin(caller) && !selected) return this.userService.findAllGlobal();
    return this.userService.findAll(tenantId);
  }

  @Get('users/:id')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.userService.findOne(tenantId, id);
  }

  @Patch('users/:id')
  @UseGuards(TenantGuard)
  @AdminWrite()
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  update(
    @CurrentUser() caller: Caller,
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(caller, tenantId, id, updateUserDto);
  }

  @Delete('users/:id')
  @UseGuards(TenantGuard)
  @AdminWrite()
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  remove(
    @CurrentUser() caller: Caller,
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.userService.remove(caller, tenantId, id);
  }
}
