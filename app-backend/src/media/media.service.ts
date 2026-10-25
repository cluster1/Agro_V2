import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from '../site/entities/site.entity';
import { Cluster } from '../cluster/entities/cluster.entity';
import { assertOwned } from '../common/utils/assert-owned';
import { safeUnlinkUpload } from './media-files';
import { v4 as uuidv4 } from 'uuid';
import { Media } from './entities/media.entity';
import { CreateMediaDto } from './dto/create-media.dto';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    createMediaDto: CreateMediaDto,
    filePath: string,
  ): Promise<Media> {
    const manager = this.mediaRepository.manager;
    await assertOwned(manager, Site, { site_id: createMediaDto.site_id, tenant_id: tenantId }, 'Site');
    if (createMediaDto.cluster_id) {
      await assertOwned(manager, Cluster, { cluster_id: createMediaDto.cluster_id, tenant_id: tenantId }, 'Cluster');
    }

    const media = this.mediaRepository.create({
      ...createMediaDto,
      media_id: uuidv4(),
      tenant_id: tenantId,
      user_id: userId,
      media_path: filePath,
      media_date: new Date(),
    });

    return await this.mediaRepository.save(media);
  }

  async findAll(tenantId: string, siteId?: string): Promise<Media[]> {
    return await this.mediaRepository.find({
      where: siteId ? { tenant_id: tenantId, site_id: siteId } : { tenant_id: tenantId },
      relations: ['site', 'cluster', 'user'],
      order: { media_date: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<Media> {
    const media = await this.mediaRepository.findOne({
      where: { media_id: id, tenant_id: tenantId },
      relations: ['site', 'cluster', 'user', 'tenant'],
    });

    if (!media) {
      throw new NotFoundException(`Media with ID ${id} not found`);
    }

    return media;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const media = await this.findOne(tenantId, id);
    const mediaPath = media.media_path;
    await this.mediaRepository.remove(media);
    await safeUnlinkUpload(mediaPath);
  }

  async findByCluster(tenantId: string, clusterId: string, limit: number = 10): Promise<Media[]> {
    return await this.mediaRepository.find({
      where: { cluster_id: clusterId, tenant_id: tenantId },
      order: { media_date: 'DESC' },
      take: limit,
    });
  }

  async findBySite(tenantId: string, siteId: string, limit: number = 10): Promise<Media[]> {
    return await this.mediaRepository.find({
      where: { site_id: siteId, tenant_id: tenantId },
      order: { media_date: 'DESC' },
      take: limit,
    });
  }
}
