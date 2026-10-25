import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from './entities/alert.entity';
import { AlertFilterDto } from './dto/alert-filter.dto';

@Injectable()
export class AlertService {
  constructor(
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
  ) {}

  async findAll(tenantId: string, filters?: AlertFilterDto): Promise<any[]> {
    let query = `
      SELECT 
        tm_alarm.alm_id,
        tm_alarm.alm_date,
        tr_alarm_code.alcode_note,
        tm_device.dev_name,
        tm_device.dev_id,
        td_device_sensor.ds_name,
        td_device_sensor.ds_id,
        DATE_FORMAT(tm_sensor_read.read_date, "%d/%m/%Y %H:%i:%s") AS read_date,
        tm_sensor_read.read_value,
        tr_unit.unit_symbol,
        tm_site.site_name,
        tm_site.site_id,
        tm_cluster.cluster_name,
        tm_cluster.cluster_id,
        tm_tenant.tenant_name,
        tm_tenant.tenant_id
      FROM tm_alarm
      LEFT JOIN tm_sensor_read ON tm_alarm.read_id = tm_sensor_read.read_id
      LEFT JOIN tr_alarm_code ON tm_alarm.alcode_id = tr_alarm_code.alcode_id
      LEFT JOIN tm_device ON tm_device.dev_id = tm_sensor_read.dev_id
      LEFT JOIN td_device_sensor ON td_device_sensor.ds_id = tm_sensor_read.ds_id 
        AND tm_sensor_read.dev_id = td_device_sensor.dev_id
      LEFT JOIN tr_unit ON tr_unit.unit_id = td_device_sensor.unit_id
      LEFT JOIN tm_tenant ON tm_device.tenant_id = tm_tenant.tenant_id
      LEFT JOIN tm_cluster ON tm_cluster.cluster_id = tm_device.cluster_id
      LEFT JOIN tm_site ON tm_device.site_id = tm_site.site_id
      WHERE tm_device.tenant_id = ?
    `;

    const params: any[] = [tenantId];

    // Apply date filters - default to last 7 days if no dates provided
    if (filters?.startDate) {
      query += ` AND DATE(tm_alarm.alm_date) >= ?`;
      params.push(filters.startDate);
    } else {
      // Default: 7 days ago
      query += ` AND DATE(tm_alarm.alm_date) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
    }

    if (filters?.endDate) {
      query += ` AND DATE(tm_alarm.alm_date) <= ?`;
      params.push(filters.endDate);
    }

    if (filters?.siteId) {
      query += ` AND tm_site.site_id = ?`;
      params.push(filters.siteId);
    }

    if (filters?.clusterId) {
      query += ` AND tm_cluster.cluster_id = ?`;
      params.push(filters.clusterId);
    }

    if (filters?.deviceId) {
      query += ` AND tm_device.dev_id = ?`;
      params.push(filters.deviceId);
    }

    query += ` ORDER BY tm_alarm.alm_date DESC LIMIT 500`;

    return await this.alertRepository.query(query, params);
  }

  async findOne(id: string, scope: string | undefined): Promise<Alert> {
    // Alert has no tenant_id: scope through its cluster or the device of its sensor reading
    const qb = this.alertRepository
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.cluster', 'cluster')
      .leftJoinAndSelect('alert.alarmCode', 'alarmCode')
      .leftJoinAndSelect('alert.sensorRead', 'sensorRead')
      .where('alert.alm_id = :id', { id });
    if (scope) {
      qb.andWhere(
        '(cluster.tenant_id = :tenantId OR sensorRead.dev_id IN (SELECT d.dev_id FROM tm_device d WHERE d.tenant_id = :tenantId))',
        { tenantId: scope },
      );
    }
    const alert = await qb.getOne();

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }

    return alert;
  }
}
