import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from './entities/device.entity';
import { Site } from '../site/entities/site.entity';
import { Cluster } from '../cluster/entities/cluster.entity';
import { assertOwned } from '../common/utils/assert-owned';
import { scoped } from '../common/utils/scope';
import { escapeRegExp } from '../common/utils/escape-regexp';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DeviceService {
  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
  ) {}

  private readonly logger = new Logger(DeviceService.name);

  // Verify referenced site/cluster exist in the tenant (and cluster belongs to site)
  private async assertParents(tenantId: string, siteId?: string, clusterId?: string): Promise<void> {
    const manager = this.deviceRepository.manager;
    if (siteId) {
      await assertOwned(manager, Site, { site_id: siteId, tenant_id: tenantId }, `Site with ID ${siteId}`);
    }
    if (clusterId) {
      const cluster = await assertOwned(
        manager,
        Cluster,
        { cluster_id: clusterId, tenant_id: tenantId },
        `Cluster with ID ${clusterId}`,
      );
      if (siteId && cluster.site_id !== siteId) {
        throw new BadRequestException('Cluster does not belong to the given site');
      }
    }
  }

  async create(tenantId: string, userId: string, createDeviceDto: CreateDeviceDto): Promise<Device> {
    await this.assertParents(tenantId, createDeviceDto.site_id, createDeviceDto.cluster_id);
    try {
      // Generate dev_id with format cluster_id_DEV<number>
      const deviceId = await this.generateDeviceId(createDeviceDto.cluster_id);
      
      const deviceData = {
        ...createDeviceDto,
        dev_id: deviceId,
        tenant_id: tenantId,
        user_id: userId,
        dev_sts: createDeviceDto.dev_sts ?? 1, // Default status 1 (active)
        dev_created: new Date(),
        dev_update: new Date(),
      };
      
      const device = this.deviceRepository.create(deviceData);
      await this.deviceRepository.insert(device);
      
      // Fetch the newly created device to return complete data with relations
      const result = await this.deviceRepository.findOne({
        where: { dev_id: deviceId, cluster_id: createDeviceDto.cluster_id },
        relations: ['site', 'cluster', 'sensors'],
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to create device: ${error?.message}`);
      throw error;
    }
  }

  private async generateDeviceId(clusterId: string): Promise<string> {
    // Get the last device ID for this cluster to determine the next number
    // Format: {cluster_id}_DEV{number}
    const pattern = `${clusterId}_DEV%`;
    const lastDevice = await this.deviceRepository
      .createQueryBuilder('device')
      .where('device.cluster_id = :clusterId', { clusterId })
      .andWhere('device.dev_id LIKE :pattern', { pattern })
      .orderBy('device.dev_id', 'DESC')
      .getOne();

    if (!lastDevice) {
      return `${clusterId}_DEV1`;
    }

    // Extract number from last device ID (e.g., "CLUSTER1_DEV5" -> 5)
    const regex = new RegExp(`${escapeRegExp(clusterId)}_DEV(\\d+)`);
    const match = lastDevice.dev_id.match(regex);
    const lastNumber = match ? parseInt(match[1]) : 0;
    const nextNumber = lastNumber + 1;

    return `${clusterId}_DEV${nextNumber}`;
  }

  async findAll(clusterId: string | undefined, scope: string | undefined): Promise<Device[]> {
    return await this.deviceRepository.find({
      where: scoped(clusterId ? { cluster_id: clusterId } : {}, scope),
      relations: ['site', 'cluster', 'sensors'],
    });
  }

  async findOne(id: string, clusterId: string | undefined, scope: string | undefined): Promise<Device> {
    const device = await this.deviceRepository.findOne({
      where: scoped(clusterId ? { dev_id: id, cluster_id: clusterId } : { dev_id: id }, scope),
      relations: ['site', 'cluster', 'tenant', 'sensors'],
    });

    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }

    return device;
  }

  async update(id: string, updateDeviceDto: UpdateDeviceDto, scope: string | undefined): Promise<Device> {
    const device = await this.findOne(id, undefined, scope);

    // Parents must belong to the device's tenant
    const newSite = updateDeviceDto.site_id ?? device.site_id;
    const newCluster = updateDeviceDto.cluster_id ?? device.cluster_id;
    if (updateDeviceDto.site_id || updateDeviceDto.cluster_id) {
      await this.assertParents(device.tenant_id, newSite, newCluster);
    }

    // Never allow tenant/primary key/owner changes via DTO (only whitelisted DTO fields applied)
    await this.deviceRepository.update({ dev_id: device.dev_id }, { ...updateDeviceDto, dev_update: new Date() });

    return await this.findOne(id, undefined, scope);
  }

  async remove(id: string, scope: string | undefined): Promise<void> {
    const device = await this.findOne(id, undefined, scope);
    await this.deviceRepository.remove(device);
  }
}
