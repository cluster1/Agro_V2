import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';
import { TwinService } from './twin.service';

class TwinQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  siteId?: string;
}

@ApiTags('twin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller()
export class TwinController {
  constructor(private readonly twinService: TwinService) {}

  @Get('twin')
  @ApiOperation({ summary: 'Tanaman aktif untuk pemilih petak dan peta twin (filter: siteId)' })
  site(@TenantScope() scope: string | undefined, @Query() query: TwinQueryDto) {
    return this.twinService.siteTwin(query.siteId, scope);
  }

  @Get('plants/:id/twin')
  @ApiOperation({ summary: 'Data agregat Digital Twin satu tanaman dalam satu panggilan' })
  plant(@TenantScope() scope: string | undefined, @Param('id') id: string) {
    return this.twinService.plantTwin(id, scope);
  }
}
