import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFile, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { isGlobalAdmin } from '../common/constants/roles';
import { assertUploadedFile, IMAGE_ONLY, secureFileFilter, secureStorage } from '../common/utils/secure-upload';

@ApiTags('tenants')
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Tambah tenant baru (Global Admin only)',
    description: 'Menambahkan tenant baru dengan tenant_id yang di-generate otomatis dengan format TENANT<number>'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Tenant berhasil ditambahkan. tenant_id akan di-generate otomatis dengan format TENANT1, TENANT2, dst.'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Data tidak valid'
  })
  async create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantService.create(createTenantDto);
  }

  @Post('upload-logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'tenant_admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload logo tenant' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Logo berhasil diupload' })
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: secureStorage('./uploads/tenant-logos', 'tenant-logo-'),
      fileFilter: secureFileFilter(IMAGE_ONLY),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    assertUploadedFile(file);

    const logoPath = `uploads/tenant-logos/${file.filename}`;
    
    return {
      message: 'Logo uploaded successfully',
      filename: file.filename,
      path: logoPath,
      url: `/${logoPath}`,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all tenants (Global Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all tenants' })
  findAll() {
    return this.tenantService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiResponse({ status: 200, description: 'Tenant details' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    if (!isGlobalAdmin(user) && user.tenant_id !== id) {
      throw new ForbiddenException('Access denied to this tenant');
    }
    return this.tenantService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update tenant (Global Admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantService.update(id, updateTenantDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete tenant (Global Admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant deleted successfully' })
  remove(@Param('id') id: string) {
    return this.tenantService.remove(id);
  }
}
