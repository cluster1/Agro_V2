import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiResponse } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AdminWrite } from '../common/decorators/admin-write.decorator';
import { parseBoundedInt } from '../common/utils/parse-bounded-int';
import { safeUnlinkUpload } from './media-files';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { assertUploadedFile, IMAGE_AND_VIDEO, secureFileFilter, secureStorage } from '../common/utils/secure-upload';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 500;

const parseLimit = (value: unknown) => parseBoundedInt('limit', value, DEFAULT_LIMIT, 1, MAX_LIMIT);

@ApiTags('media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('tenants/:tenantId/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @AdminWrite()
  @ApiOperation({ summary: 'Upload media file' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Media uploaded successfully' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: secureStorage('./uploads'),
      fileFilter: secureFileFilter(IMAGE_AND_VIDEO),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async create(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: any,
    @Body() createMediaDto: CreateMediaDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // multer has already written the file; remove it if validation or ownership checks fail.
    try {
      return await this.mediaService.create(tenantId, user.user_id, createMediaDto, assertUploadedFile(file).path);
    } catch (error) {
      await safeUnlinkUpload(file?.path);
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all media in tenant' })
  @ApiResponse({ status: 200, description: 'List of media' })
  findAll(
    @Param('tenantId') tenantId: string,
    @Query('siteId') siteId?: string,
  ) {
    return this.mediaService.findAll(tenantId, siteId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get media by ID' })
  @ApiResponse({ status: 200, description: 'Media details' })
  findOne(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.mediaService.findOne(tenantId, id);
  }

  @Delete(':id')
  @AdminWrite()
  @ApiOperation({ summary: 'Delete media' })
  @ApiResponse({ status: 200, description: 'Media deleted successfully' })
  remove(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.mediaService.remove(tenantId, id);
  }

  @Get('cluster/:clusterId')
  @ApiOperation({ summary: 'Get media by cluster ID' })
  @ApiResponse({ status: 200, description: 'List of media for cluster' })
  findByCluster(
    @Param('tenantId') tenantId: string,
    @Param('clusterId') clusterId: string,
    @Query('limit') limit?: number,
  ) {
    return this.mediaService.findByCluster(tenantId, clusterId, parseLimit(limit));
  }

  @Get('site/:siteId')
  @ApiOperation({ summary: 'Get media by site ID' })
  @ApiResponse({ status: 200, description: 'List of media for site' })
  findBySite(
    @Param('tenantId') tenantId: string,
    @Param('siteId') siteId: string,
    @Query('limit') limit?: number,
  ) {
    return this.mediaService.findBySite(tenantId, siteId, parseLimit(limit));
  }
}
