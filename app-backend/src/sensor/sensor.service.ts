import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Sensor } from './entities/sensor.entity';
import { Device } from '../device/entities/device.entity';
import { DeviceSensor } from '../device-sensor/entities/device-sensor.entity';
import { assertOwned } from '../common/utils/assert-owned';
import { scoped } from '../common/utils/scope';
import { escapeRegExp } from '../common/utils/escape-regexp';
import { CreateSensorDto } from './dto/create-sensor.dto';
import { UpdateSensorDto } from './dto/update-sensor.dto';

@Injectable()
export class SensorService {
  constructor(
    @InjectRepository(Sensor)
    private sensorRepository: Repository<Sensor>,
    private dataSource: DataSource,
  ) {}

  private readonly logger = new Logger(SensorService.name);

  async create(tenantId: string, createSensorDto: CreateSensorDto): Promise<Sensor> {
    // Device must exist and belong to the tenant
    await assertOwned(
      this.sensorRepository.manager,
      Device,
      { dev_id: createSensorDto.dev_id, tenant_id: tenantId },
      `Device with ID ${createSensorDto.dev_id}`,
    );

    try {
      // Generate sens_id with format device_id_SENS<number>
      const sensorId = await this.generateSensorId(createSensorDto.dev_id);
      
      const sensor = this.sensorRepository.create({
        sens_seq: createSensorDto.sens_seq !== undefined ? createSensorDto.sens_seq : 0,
        ...createSensorDto,
        sens_id: sensorId,
        tenant_id: tenantId,
      });

      await this.sensorRepository.insert(sensor);
      
      // Fetch the newly created sensor to return complete data with relations
      const result = await this.sensorRepository.findOne({
        where: { sens_id: sensorId, dev_id: createSensorDto.dev_id, tenant_id: tenantId },
        relations: ['device', 'parameters'],
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to create sensor: ${error?.message}`);
      throw error;
    }
  }

  private async generateSensorId(deviceId: string): Promise<string> {
    // Get the last sensor ID for this device to determine the next number
    // Format: {device_id}_SENS{number}
    const pattern = `${deviceId}_SENS%`;
    const lastSensor = await this.sensorRepository
      .createQueryBuilder('sensor')
      .where('sensor.dev_id = :deviceId', { deviceId })
      .andWhere('sensor.sens_id LIKE :pattern', { pattern })
      .orderBy('sensor.sens_id', 'DESC')
      .getOne();

    if (!lastSensor) {
      return `${deviceId}_SENS1`;
    }

    // Extract number from last sensor ID (e.g., "DEVICE1_SENS5" -> 5)
    const regex = new RegExp(`${escapeRegExp(deviceId)}_SENS(\\d+)`);
    const match = lastSensor.sens_id.match(regex);
    const lastNumber = match ? parseInt(match[1]) : 0;
    const nextNumber = lastNumber + 1;

    return `${deviceId}_SENS${nextNumber}`;
  }

  async findAll(deviceId: string, scope: string | undefined): Promise<Sensor[]> {
    return await this.sensorRepository.find({
      where: scoped({ dev_id: deviceId }, scope),
      relations: ['device', 'parameters'],
      order: { sens_seq: 'ASC' },
    });
  }

  async findOne(id: string, deviceId: string, scope: string | undefined): Promise<Sensor> {
    if (!deviceId) {
      throw new NotFoundException('Device ID is required to find sensor');
    }

    const sensor = await this.sensorRepository.findOne({
      where: scoped({ sens_id: id, dev_id: deviceId }, scope),
      relations: ['device', 'tenant', 'parameters'],
    });

    if (!sensor) {
      throw new NotFoundException(`Sensor with ID ${id} and Device ID ${deviceId} not found`);
    }

    return sensor;
  }

  async update(id: string, deviceId: string, updateSensorDto: UpdateSensorDto, scope: string | undefined): Promise<Sensor> {
    const sensor = await this.findOne(id, deviceId, scope);
    
    // Update sensor (master only, parameters managed separately)
    // Don't allow changing sens_id or dev_id as they are composite primary keys
    const { sens_id, dev_id, ...updateData } = updateSensorDto;
    Object.assign(sensor, updateData);
    await this.sensorRepository.save(sensor);

    // Return updated sensor
    return await this.findOne(id, deviceId, scope);
  }

  async remove(id: string, deviceId: string, scope: string | undefined): Promise<void> {
    // Verify ownership before any delete
    const sensor = await this.findOne(id, deviceId, scope);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Delete parameters first (detail)
      await queryRunner.manager.delete(DeviceSensor, { sens_id: id, dev_id: deviceId });

      // Delete sensor (master)
      await queryRunner.manager.remove(sensor);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
