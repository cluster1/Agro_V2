import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { escapeRegExp } from '../common/utils/escape-regexp';
import { Site } from './entities/site.entity';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SiteService {
  private readonly logger = new Logger(SiteService.name);

  constructor(
    @InjectRepository(Site)
    private siteRepository: Repository<Site>,
  ) {}

  async create(tenantId: string, createSiteDto: CreateSiteDto): Promise<Site> {
    try {
      // Generate site_id with format SITE<number>
      const siteId = await this.generateSiteId(tenantId);
      
      const siteData = {
        ...createSiteDto,
        site_id: siteId,
        tenant_id: tenantId,
        site_sts: createSiteDto.site_sts ?? 1, // Default status 1 (active)
        site_created: new Date(),
        site_update: new Date(),
      };
      
      const site = this.siteRepository.create(siteData);
      await this.siteRepository.insert(site);
      
      // Fetch the newly created site to return complete data with relations
      const result = await this.siteRepository.findOne({
        where: { site_id: siteId, tenant_id: tenantId },
        relations: ['clusters'],
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to create site: ${error?.message}`);
      throw error;
    }
  }

  private async generateSiteId(tenantId: string): Promise<string> {
    // Get the last site ID for this tenant to determine the next number
    // Format: {tenant_id}_SITE{number}
    const pattern = `${tenantId}_SITE%`;
    const lastSite = await this.siteRepository
      .createQueryBuilder('site')
      .where('site.tenant_id = :tenantId', { tenantId })
      .andWhere('site.site_id LIKE :pattern', { pattern })
      .orderBy('site.site_id', 'DESC')
      .getOne();

    if (!lastSite) {
      return `${tenantId}_SITE1`;
    }

    // Extract number from last site ID (e.g., "TENANT1_SITE5" -> 5)
    const regex = new RegExp(`${escapeRegExp(tenantId)}_SITE(\\d+)`);
    const match = lastSite.site_id.match(regex);
    const lastNumber = match ? parseInt(match[1]) : 0;
    const nextNumber = lastNumber + 1;

    return `${tenantId}_SITE${nextNumber}`;
  }

  async findAll(tenantId: string): Promise<Site[]> {
    return await this.siteRepository.find({
      where: { tenant_id: tenantId },
      relations: ['clusters'],
    });
  }

  async findOne(tenantId: string, id: string): Promise<Site> {
    const site = await this.siteRepository.findOne({
      where: { site_id: id, tenant_id: tenantId },
      relations: ['clusters', 'tenant'],
    });

    if (!site) {
      throw new NotFoundException(`Site with ID ${id} not found`);
    }

    return site;
  }

  async update(tenantId: string, id: string, updateSiteDto: UpdateSiteDto): Promise<Site> {
    const site = await this.findOne(tenantId, id);
    
    const { tenant_id: _t, site_id: _s, ...rest } = updateSiteDto as any;
    Object.assign(site, rest);
    site.site_update = new Date();

    return await this.siteRepository.save(site);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const site = await this.findOne(tenantId, id);
    await this.siteRepository.remove(site);
  }
}
