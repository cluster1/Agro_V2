import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceSensor } from './entities/device-sensor.entity';
import { Sensor } from '../sensor/entities/sensor.entity';
import { Device } from '../device/entities/device.entity';
import { CreateDeviceSensorDto } from './dto/create-device-sensor.dto';
import { UpdateDeviceSensorDto } from './dto/update-device-sensor.dto';
import { assertOwned } from '../common/utils/assert-owned';
import { scoped } from '../common/utils/scope';

const CLUSTER_MISMATCH = 'cluster_id does not match the device cluster';

@Injectable()
export class DeviceSensorService {
  constructor(
    @InjectRepository(DeviceSensor)
    private deviceSensorRepository: Repository<DeviceSensor>,
  ) {}

  private readonly logger = new Logger(DeviceSensorService.name);

  async create(
    tenantId: string,
    sensId: string,
    devId: string,
    createDeviceSensorDto: CreateDeviceSensorDto,
  ): Promise<DeviceSensor> {
    try {
      const manager = this.deviceSensorRepository.manager;
      // Sensor (composite key sens_id + dev_id) and its device must belong to the tenant
      const sensor = await assertOwned(
        manager,
        Sensor,
        { sens_id: sensId, dev_id: devId, tenant_id: tenantId },
        `Sensor with ID ${sensId} and Device ID ${devId}`,
      );
      const device = await assertOwned(
        manager,
        Device,
        { dev_id: sensor.dev_id, tenant_id: tenantId },
        `Device with ID ${sensor.dev_id}`,
      );

      // A parameter lives in its device's cluster: a differing cluster_id is rejected
      if (createDeviceSensorDto.cluster_id && createDeviceSensorDto.cluster_id !== device.cluster_id) {
        throw new BadRequestException(CLUSTER_MISMATCH);
      }

      const deviceSensorData = {
        ds_sts: createDeviceSensorDto.ds_sts !== undefined ? createDeviceSensorDto.ds_sts : 1,
        ...createDeviceSensorDto,
        cluster_id: device.cluster_id,
        dev_id: sensor.dev_id,
        tenant_id: tenantId,
        sens_id: sensId,
      };

      const deviceSensor = this.deviceSensorRepository.create(deviceSensorData);
      await this.deviceSensorRepository.insert(deviceSensor);

      // Fetch the newly created parameter to return complete data with composite key
      return await this.deviceSensorRepository.findOne({
        where: { ds_id: createDeviceSensorDto.ds_id, dev_id: sensor.dev_id, sens_id: sensId, tenant_id: tenantId },
      });
    } catch (error) {
      this.logger.error(`Failed to create parameter: ${error?.message}`);
      throw error;
    }
  }

  async findAll(sensId: string, devId: string | undefined, scope: string | undefined): Promise<DeviceSensor[]> {
    return await this.deviceSensorRepository.find({
      where: scoped(devId ? { sens_id: sensId, dev_id: devId } : { sens_id: sensId }, scope),
      order: { ds_seq: 'ASC' },
    });
  }

  async findOne(id: string, devId: string, sensId: string, scope: string | undefined): Promise<DeviceSensor> {
    if (!devId || !sensId) {
      throw new NotFoundException('Device ID and Sensor ID are required to find parameter');
    }

    const deviceSensor = await this.deviceSensorRepository.findOne({
      where: scoped({ ds_id: id, dev_id: devId, sens_id: sensId }, scope),
    });

    if (!deviceSensor) {
      throw new NotFoundException(`Parameter with ID ${id}, Device ID ${devId}, and Sensor ID ${sensId} not found`);
    }

    return deviceSensor;
  }

  async update(
    id: string,
    devId: string,
    sensId: string,
    updateDeviceSensorDto: UpdateDeviceSensorDto,
    scope: string | undefined,
  ): Promise<DeviceSensor> {
    const deviceSensor = await this.findOne(id, devId, sensId, scope);

    // The parameter's cluster always follows its device; a differing cluster_id is rejected
    const device = await assertOwned(
      this.deviceSensorRepository.manager,
      Device,
      { dev_id: deviceSensor.dev_id, tenant_id: deviceSensor.tenant_id },
      `Device with ID ${deviceSensor.dev_id}`,
    );

    // Don't allow changing primary key fields (ds_id, dev_id, sens_id)
    const { ds_id, cluster_id, ...updateData } = updateDeviceSensorDto;
    if (cluster_id && cluster_id !== device.cluster_id) {
      throw new BadRequestException(CLUSTER_MISMATCH);
    }
    deviceSensor.cluster_id = device.cluster_id;
    Object.assign(deviceSensor, updateData);
    return await this.deviceSensorRepository.save(deviceSensor);
  }

  async remove(id: string, devId: string, sensId: string, scope: string | undefined): Promise<void> {
    const deviceSensor = await this.findOne(id, devId, sensId, scope);
    await this.deviceSensorRepository.remove(deviceSensor);
  }
}
