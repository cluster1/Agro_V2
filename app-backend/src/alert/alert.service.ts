import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from './entities/alert.entity';
import { AlertFilterDto } from './dto/alert-filter.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { scoped } from '../common/utils/scope';

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
        tm_alarm.alcode_id,
        tm_alarm.alm_sts,
        tm_alarm.alm_ack_user,
        tm_alarm.alm_ack_date,
        tm_alarm.alm_note,
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
      WHERE tm_alarm.tenant_id = ?
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

    if (filters?.status !== undefined) {
      query += ` AND IFNULL(tm_alarm.alm_sts, 0) = ?`;
      params.push(filters.status);
    }

    if (filters?.code) {
      query += ` AND tm_alarm.alcode_id = ?`;
      params.push(filters.code);
    }

    if (filters?.deviceId) {
      query += ` AND tm_device.dev_id = ?`;
      params.push(filters.deviceId);
    }

    query += ` ORDER BY tm_alarm.alm_date DESC LIMIT 500`;

    return await this.alertRepository.query(query, params);
  }

  async findOne(id: string, scope: string | undefined): Promise<Alert> {
    const alert = await this.alertRepository.findOne({
      where: scoped({ alm_id: id }, scope),
      relations: ['alarmCode', 'sensorRead'],
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }

    return alert;
  }

  /** Marks an alert as seen (1) or resolved (2); status only moves forward. */
  async acknowledge(
    id: string,
    scope: string | undefined,
    userId: string,
    dto: UpdateAlertDto,
  ): Promise<Alert> {
    const alert = await this.findOne(id, scope);
    const current = alert.alm_sts ?? 0;

    if (current === 2) {
      throw new BadRequestException('Alert sudah selesai ditangani');
    }
    if (dto.alm_sts < current) {
      throw new BadRequestException('Status alert tidak bisa dikembalikan');
    }

    alert.alm_sts = dto.alm_sts;
    alert.alm_ack_user = userId;
    alert.alm_ack_date = new Date();
    if (dto.alm_note !== undefined) alert.alm_note = dto.alm_note;

    return this.alertRepository.save(alert);
  }
}
