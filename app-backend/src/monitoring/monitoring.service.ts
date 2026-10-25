import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SensorRead } from './entities/sensor-read.entity';
import { SensorReadUpdate } from './entities/sensor-read-update.entity';
import { Device } from '../device/entities/device.entity';
import { DeviceSensor } from '../device-sensor/entities/device-sensor.entity';
import { Alert } from '../alert/entities/alert.entity';
import { scoped } from '../common/utils/scope';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    @InjectRepository(SensorRead)
    private sensorReadRepository: Repository<SensorRead>,
    @InjectRepository(SensorReadUpdate)
    private sensorReadUpdateRepository: Repository<SensorReadUpdate>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(DeviceSensor)
    private deviceSensorRepository: Repository<DeviceSensor>,
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
  ) {}

  // Ensure device exists and (when scope is set) belongs to the tenant
  private async assertDeviceAccess(devId: string, scope: string | undefined) {
    if (!devId) {
      throw new BadRequestException('devId is required');
    }
    const device = await this.deviceRepository.findOne({ where: scoped({ dev_id: devId }, scope), select: ['dev_id'] });
    if (!device) {
      throw new NotFoundException('Device not found');
    }
  }

  // Get all devices with their sensors and latest readings
  async getDevicesWithSensors(tenantId: string, siteId?: string, clusterId?: string) {
    const queryBuilder = this.deviceRepository
      .createQueryBuilder('device')
      .leftJoinAndSelect('device.sensors', 'sensor')
      .leftJoinAndSelect('sensor.parameters', 'parameter')
      .leftJoinAndSelect('parameter.unit', 'unit')
      .leftJoinAndSelect('device.cluster', 'cluster')
      .leftJoinAndSelect('cluster.site', 'site')
      .where('device.tenant_id = :tenantId', { tenantId });

    if (siteId) {
      queryBuilder.andWhere('cluster.site_id = :siteId', { siteId });
    }

    if (clusterId) {
      queryBuilder.andWhere('device.cluster_id = :clusterId', { clusterId });
    }

    const devices = await queryBuilder.getMany();

    // Get latest readings for each device
    const devicesWithReadings = await Promise.all(
      devices.map(async (device) => {
        const sensorsWithReadings = await Promise.all(
          device.sensors.map(async (sensor) => {
            const parametersWithReadings = await Promise.all(
              sensor.parameters.map(async (parameter) => {
                const latestReading = await this.sensorReadUpdateRepository.findOne({
                  where: {
                    dev_id: device.dev_id,
                    ds_id: parameter.ds_id,
                  },
                });

                return {
                  ...parameter,
                  latestReading,
                };
              })
            );

            return {
              ...sensor,
              parameters: parametersWithReadings,
            };
          })
        );

        return {
          ...device,
          sensors: sensorsWithReadings,
        };
      })
    );

    return devicesWithReadings;
  }

  // Get sensor history for last 24 hours
  async getSensorHistory(
    devId: string,
    sensId: string,
    dsId: string,
    hours: number = 24,
    scope: string | undefined,
  ) {
    await this.assertDeviceAccess(devId, scope);
    const date = new Date();
    date.setHours(date.getHours() - hours);

    const readings = await this.sensorReadRepository
      .createQueryBuilder('read')
      .where('read.dev_id = :devId', { devId })
      .andWhere('read.sens_id = :sensId', { sensId })
      .andWhere('read.ds_id = :dsId', { dsId })
      .andWhere('read.read_date >= :date', { date })
      .andWhere('read.read_sts = :readSts', { readSts: 1 })
      .orderBy('read.read_date', 'ASC')
      .getMany();

    return readings;
  }

  // Get history for all parameters in a device
  async getDeviceHistory(devId: string, hours: number = 24, scope: string | undefined) {
    await this.assertDeviceAccess(devId, scope);
    try {
      const date = new Date();
      date.setHours(date.getHours() - hours);

      // Get all parameters for this device with unit relation
      const parameters = await this.deviceSensorRepository.find({
        where: { dev_id: devId },
        relations: ['unit'],
      });

      if (parameters.length === 0) {
        return [];
      }

      // Get readings for each parameter
      const historyData = await Promise.all(
        parameters.map(async (parameter) => {
          try {
            // First, check if ANY data exists for this parameter (without date filter)
            const totalCount = await this.sensorReadRepository
              .createQueryBuilder('read')
              .where('read.dev_id = :devId', { devId })
              .andWhere('read.ds_id = :dsId', { dsId: parameter.ds_id })
              .getCount();
            
            // Now get with all filters
            const readings = await this.sensorReadRepository
              .createQueryBuilder('read')
              .where('read.dev_id = :devId', { devId })
              .andWhere('read.ds_id = :dsId', { dsId: parameter.ds_id })
              .andWhere('read.read_date >= :date', { date })
              .andWhere('read.read_sts = :readSts', { readSts: 1 })
              .orderBy('read.read_date', 'DESC')
              .limit(100)
              .getMany();

            // If no readings in time range but data exists, get latest 100 records
            let finalReadings = readings;
            if (readings.length === 0 && totalCount > 0) {
              finalReadings = await this.sensorReadRepository
                .createQueryBuilder('read')
                .where('read.dev_id = :devId', { devId })
                .andWhere('read.ds_id = :dsId', { dsId: parameter.ds_id })
                .andWhere('read.read_sts = :readSts', { readSts: 1 })
                .orderBy('read.read_date', 'DESC')
                .limit(100)
                .getMany();
              
              // Reverse to get chronological order
              finalReadings = finalReadings.reverse();
            }

            return {
              parameter: {
                ds_id: parameter.ds_id,
                ds_name: parameter.ds_name,
                sens_id: parameter.sens_id,
                unit_id: parameter.unit_id,
                ds_min_value: parameter.ds_min_value,
                ds_max_value: parameter.ds_max_value,
                unit_name: parameter.unit?.unit_name,
                unit_symbol: parameter.unit?.unit_symbol,
              },
              readings: finalReadings,
            };
          } catch (error) {
            this.logger.error(`Error fetching readings for parameter ${parameter.ds_id}: ${error?.message}`);
            return {
              parameter: {
                ds_id: parameter.ds_id,
                ds_name: parameter.ds_name,
                sens_id: parameter.sens_id,
                unit_id: parameter.unit_id,
                ds_min_value: parameter.ds_min_value,
                ds_max_value: parameter.ds_max_value,
                unit_name: parameter.unit?.unit_name,
                unit_symbol: parameter.unit?.unit_symbol,
              },
              readings: [],
            };
          }
        })
      );

      return historyData;
    } catch (error) {
      this.logger.error(`Error in getDeviceHistory: ${error?.message}`);
      throw error;
    }
  }

  // Get last 10 sensor readings for a tenant
  async getLastReadings(tenantId: string, limit: number = 10) {
    try {
      const query = `
        SELECT 
          tm_device.dev_name, 
          td_device_sensor.ds_name, 
          DATE_FORMAT(tm_sensor_read.read_date, "%d/%m/%Y %H:%i:%s") as read_date, 
          tm_sensor_read.read_value,
          tr_unit.unit_symbol
        FROM tm_sensor_read
        LEFT JOIN tm_device ON tm_device.dev_id = tm_sensor_read.dev_id
        LEFT JOIN td_device_sensor ON td_device_sensor.ds_id = tm_sensor_read.ds_id 
          AND tm_sensor_read.dev_id = td_device_sensor.dev_id
        LEFT JOIN tr_unit ON tr_unit.unit_id = td_device_sensor.unit_id
        WHERE tm_sensor_read.tenant_id = ?
        ORDER BY tm_sensor_read.read_date DESC
        LIMIT ?
      `;

      const results = await this.sensorReadRepository.query(query, [tenantId, limit]);
      return results;
    } catch (error) {
      this.logger.error(`Error in getLastReadings: ${error?.message}`);
      throw error;
    }
  }

  // Get alerts for a tenant (last 24 hours by default)
  async getAlerts(tenantId: string, hours: number = 24) {
    const date = new Date();
    date.setHours(date.getHours() - hours);

    const query = `
      SELECT 
        DATE_FORMAT(tm_alarm.alm_date, "%d/%m/%Y %H:%i:%s") AS alm_date,
        tr_alarm_code.alcode_note,
        tm_device.dev_name, 
        td_device_sensor.ds_name, 
        DATE_FORMAT(tm_sensor_read.read_date, "%d/%m/%Y %H:%i:%s") AS read_date, 
        tm_sensor_read.read_value,
        tr_unit.unit_symbol 
      FROM tm_alarm
      LEFT JOIN tm_sensor_read ON tm_alarm.read_id = tm_sensor_read.read_id 
      LEFT JOIN tr_alarm_code ON tm_alarm.alcode_id = tr_alarm_code.alcode_id
      LEFT JOIN tm_device ON tm_device.dev_id = tm_sensor_read.dev_id
      LEFT JOIN td_device_sensor ON td_device_sensor.ds_id = tm_sensor_read.ds_id 
        AND tm_sensor_read.dev_id = td_device_sensor.dev_id
      LEFT JOIN tr_unit ON tr_unit.unit_id = td_device_sensor.unit_id
      WHERE tm_sensor_read.tenant_id = ?
        AND tm_alarm.alm_date >= ?
      ORDER BY tm_alarm.alm_date DESC
    `;

    try {
      const results = await this.alertRepository.query(query, [tenantId, date]);
      return results;
    } catch (error) {
      this.logger.error(`Error in getAlerts: ${error?.message}`);
      throw error;
    }
  }

  // Get sensor parameter summary
  async getSensorSummary(tenantId: string) {
    const query = `
      SELECT 
        a.ds_id, 
        a.dev_id,
        a.tenant_id,
        a.read_update_date, 
        a.read_update_value, 
        b.sens_id,
        b.ds_name,
        b.ds_min_value,
        b.ds_max_value,
        b.ds_min_norm_value, 
        b.ds_max_norm_value,
        b.ds_min_val_warn, 
        b.ds_max_val_warn, 
        c.unit_symbol,
        d.dev_name,
        t.tenant_name
      FROM tm_sensor_read_update a 
      INNER JOIN td_device_sensor b ON a.ds_id = b.ds_id AND a.dev_id = b.dev_id
      INNER JOIN tm_device d ON a.dev_id = d.dev_id
      LEFT JOIN tr_unit c ON b.unit_id = c.unit_id
      LEFT JOIN tm_tenant t ON a.tenant_id = t.tenant_id
      WHERE a.tenant_id = ?
      ORDER BY a.read_update_date DESC
    `;

    try {
      
      const results = await this.sensorReadUpdateRepository.query(query, [tenantId]);
      
      // Process results
      const abnormalParams = [];
      let normalCount = 0;
      
      results.forEach(param => {
        const value = parseFloat(param.read_update_value);
        const minNorm = parseFloat(param.ds_min_norm_value);
        const maxNorm = parseFloat(param.ds_max_norm_value);
        
        if (!isNaN(value) && !isNaN(minNorm) && !isNaN(maxNorm)) {
          if (value <= minNorm) {
            abnormalParams.push({
              ds_id: param.ds_id,
              sensor_name: param.ds_name,
              sensor_id: param.sens_id,
              device_id: param.dev_id,
              device_name: param.dev_name,
              tenant_id: param.tenant_id,
              tenant_name: param.tenant_name,
              value: value,
              unit: param.unit_symbol,
              status: 'below',
              message: `Nilai Dibawah Normal (${minNorm}${param.unit_symbol || ''})`,
              min_normal: minNorm,
              max_normal: maxNorm,
              last_update: param.read_update_date
            });
          } else if (value >= maxNorm) {
            abnormalParams.push({
              ds_id: param.ds_id,
              sensor_name: param.ds_name,
              sensor_id: param.sens_id,
              device_id: param.dev_id,
              device_name: param.dev_name,
              tenant_id: param.tenant_id,
              tenant_name: param.tenant_name,
              value: value,
              unit: param.unit_symbol,
              status: 'above',
              message: `Nilai Diatas Normal (${maxNorm}${param.unit_symbol || ''})`,
              min_normal: minNorm,
              max_normal: maxNorm,
              last_update: param.read_update_date
            });
          } else {
            normalCount++;
          }
        }
      });

      const summary = {
        total: results.length,
        normal: normalCount,
        abnormal: abnormalParams.length,
        abnormal_params: abnormalParams,
        all_normal: abnormalParams.length === 0,
        message: abnormalParams.length === 0 ? 'All Parameter Normal' : `${abnormalParams.length} Parameter Abnormal`
      };
      
      return summary;
    } catch (error) {
      this.logger.error(`Error in getSensorSummary: ${error?.message}`);
      throw error;
    }
  }
}
