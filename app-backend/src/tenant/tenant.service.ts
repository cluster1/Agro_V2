import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    try {
      // Generate tenant_id with format TENANT<number>
      const tenantId = await this.generateTenantId();
      
      const { tenant_sts, ...rest } = createTenantDto;
      const tenantData = {
        tenant_id: tenantId,
        ...rest,
        // DB column is varchar(2); API keeps numeric 0/1
        tenant_sts: String(tenant_sts ?? 1),
        tenant_created: new Date(),
        tenant_update: new Date(),
      };
      
      const tenant = this.tenantRepository.create(tenantData);
      const result = await this.tenantRepository.save(tenant);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to create tenant: ${error?.message}`);
      throw error;
    }
  }

  private async generateTenantId(): Promise<string> {
    // Get the last tenant ID to determine the next number
    const lastTenant = await this.tenantRepository
      .createQueryBuilder('tenant')
      .where('tenant.tenant_id LIKE :pattern', { pattern: 'TENANT%' })
      .orderBy('tenant.tenant_id', 'DESC')
      .getOne();

    if (!lastTenant) {
      return 'TENANT1';
    }

    // Extract number from last tenant ID (e.g., "TENANT5" -> 5)
    const lastNumber = parseInt(lastTenant.tenant_id.replace('TENANT', '')) || 0;
    const nextNumber = lastNumber + 1;

    return `TENANT${nextNumber}`;
  }

  async findAll(): Promise<Tenant[]> {
    return await this.tenantRepository.find({
      relations: ['users', 'sites'],
    });
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { tenant_id: id },
      relations: ['users', 'sites', 'clusters'],
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }

    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findOne(id);
    
    const { tenant_sts, ...rest } = updateTenantDto;
    Object.assign(tenant, rest);
    if (tenant_sts !== undefined) tenant.tenant_sts = String(tenant_sts);
    tenant.tenant_update = new Date();

    return await this.tenantRepository.save(tenant);
  }

  async remove(id: string): Promise<void> {
    const tenant = await this.findOne(id);
    await this.tenantRepository.remove(tenant);
  }
}
