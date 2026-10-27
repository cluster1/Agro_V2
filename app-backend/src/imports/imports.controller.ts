import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { ImportWrite } from '../common/decorators/import-write.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { ImportsService } from './imports.service';
import { MAX_FILE_BYTES } from './import-parser';

const upload = () =>
  FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 1 } });

@ApiTags('imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get(':type/template')
  @ImportWrite()
  @ApiOperation({ summary: 'Unduh templat impor (harvests | observations) sebagai csv atau xlsx' })
  async template(@Param('type') type: string, @Query('format') format = 'xlsx', @Res() res: Response) {
    if (format !== 'csv' && format !== 'xlsx') throw new BadRequestException('format harus csv atau xlsx');
    const file = await this.importsService.template(this.importsService.assertType(type), format);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Post(':type/preview')
  @ImportWrite()
  @ApiOperation({ summary: 'Pratinjau impor: validasi tiap baris tanpa menyimpan' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Laporan per baris' })
  @UseInterceptors(upload())
  preview(
    @CurrentUser() user: { user_id: string },
    @TenantId() tenantId: string,
    @Param('type') type: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Berkas wajib diunggah (field "file")');
    return this.importsService.run(this.importsService.assertType(type), tenantId, user.user_id, file.buffer, false);
  }

  @Post(':type/commit')
  @ImportWrite()
  @ApiOperation({ summary: 'Simpan baris yang valid (sumber IMPORT); baris tidak valid dilaporkan' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(upload())
  commit(
    @CurrentUser() user: { user_id: string },
    @TenantId() tenantId: string,
    @Param('type') type: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Berkas wajib diunggah (field "file")');
    return this.importsService.run(this.importsService.assertType(type), tenantId, user.user_id, file.buffer, true);
  }
}
