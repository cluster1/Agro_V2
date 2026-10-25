import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Site } from '../site/entities/site.entity';
import { Cluster } from '../cluster/entities/cluster.entity';
import { Device } from '../device/entities/device.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { scoped } from '../common/utils/scope';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Site)
    private siteRepository: Repository<Site>,
    @InjectRepository(Cluster)
    private clusterRepository: Repository<Cluster>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private dataSource: DataSource,
  ) {}

  async getDashboardSummary(tenantId: string) {
    const [sitesCount, clustersCount, devicesCount] = await Promise.all([
      this.siteRepository.count({ where: { tenant_id: tenantId } }),
      this.clusterRepository.count({ where: { tenant_id: tenantId } }),
      this.deviceRepository.count({ where: { tenant_id: tenantId } }),
    ]);

    // Count sensors for this tenant
    const sensorCountQuery = `
      SELECT COUNT(sens_id) AS jml_sensor
      FROM td_sensor 
      WHERE tenant_id = ?
    `;
    const sensorResult = await this.dataSource.query(sensorCountQuery, [tenantId]);
    const sensorsCount = sensorResult[0]?.jml_sensor || 0;

    const sites = await this.siteRepository.find({
      where: { tenant_id: tenantId },
      relations: ['clusters'],
    });

    return {
      summary: {
        total_sites: sitesCount,
        total_clusters: clustersCount,
        total_devices: devicesCount,
        total_sensors: sensorsCount,
      },
      sites: sites.map(site => ({
        site_id: site.site_id,
        site_name: site.site_name,
        site_type: site.site_type,
        clusters_count: site.clusters?.length || 0,
      })),
    };
  }

  async getClusterReport(clusterId: string, scope: string | undefined) {
    const cluster = await this.clusterRepository.findOne({
      where: scoped({ cluster_id: clusterId }, scope),
      relations: ['site', 'devices'],
    });

    if (!cluster) {
      throw new NotFoundException('Cluster not found');
    }

    return {
      cluster_id: cluster.cluster_id,
      cluster_name: cluster.cluster_name,
      cluster_type: cluster.cluster_type,
      capacity: cluster.cluster_capacity,
      current: cluster.cluster_current,
      devices_count: cluster.devices?.length || 0,
      site: {
        site_id: cluster.site?.site_id,
        site_name: cluster.site?.site_name,
      },
    };
  }

  async getGlobalDashboard() {
    // Get all tenants with their related data
    const tenants = await this.tenantRepository.find({
      relations: ['sites', 'clusters', 'devices'],
    });

    // Calculate totals across all tenants
    const totalSites = await this.siteRepository.count();
    const totalClusters = await this.clusterRepository.count();
    const totalDevices = await this.deviceRepository.count();

    // Count total sensors across all tenants
    const sensorCountQuery = `
      SELECT COUNT(sens_id) AS jml_sensor
      FROM td_sensor
    `;
    const sensorResult = await this.dataSource.query(sensorCountQuery);
    const totalSensors = sensorResult[0]?.jml_sensor || 0;

    // Map tenant data
    const tenantsSummary = tenants.map(tenant => ({
      tenant_id: tenant.tenant_id,
      tenant_name: tenant.tenant_name,
      tenant_type: tenant.tenant_type,
      sites_count: tenant.sites?.length || 0,
      clusters_count: tenant.clusters?.length || 0,
      devices_count: tenant.devices?.length || 0,
    }));

    return {
      summary: {
        total_tenants: tenants.length,
        total_sites: totalSites,
        total_clusters: totalClusters,
        total_devices: totalDevices,
        total_sensors: totalSensors,
      },
      tenants: tenantsSummary,
    };
  }

  async getLatestReadings(tenantId: string) {
    const query = `
      SELECT 
        tm_device.dev_name, 
        td_device_sensor.ds_name,  
        DATE_FORMAT(tm_sensor_read.read_date, "%d/%m/%Y %H:%i:%s") as read_date, 
        tm_sensor_read.read_value,
        tr_unit.unit_symbol
      FROM tm_sensor_read
      LEFT JOIN tm_device ON tm_device.dev_id = tm_sensor_read.dev_id
      LEFT JOIN td_device_sensor ON 
        td_device_sensor.ds_id = tm_sensor_read.ds_id 
        AND tm_sensor_read.dev_id = td_device_sensor.dev_id
      LEFT JOIN tr_unit ON tr_unit.unit_id = td_device_sensor.unit_id
      WHERE tm_sensor_read.tenant_id = ?
      ORDER BY tm_sensor_read.read_date DESC
      LIMIT 10
    `;

    const readings = await this.dataSource.query(query, [tenantId]);
    return readings;
  }

  async getCombinedTimeline(tenantId: string) {
    // Get latest readings
    const readingsQuery = `
      SELECT 
        'reading' as type,
        tm_device.dev_name, 
        td_device_sensor.ds_name,  
        tm_sensor_read.read_date as event_date,
        DATE_FORMAT(tm_sensor_read.read_date, "%d/%m/%Y %H:%i:%s") as formatted_date, 
        tm_sensor_read.read_value,
        tr_unit.unit_symbol,
        NULL as alert_type,
        NULL as alert_message
      FROM tm_sensor_read
      LEFT JOIN tm_device ON tm_device.dev_id = tm_sensor_read.dev_id
      LEFT JOIN td_device_sensor ON 
        td_device_sensor.ds_id = tm_sensor_read.ds_id 
        AND tm_sensor_read.dev_id = td_device_sensor.dev_id
      LEFT JOIN tr_unit ON tr_unit.unit_id = td_device_sensor.unit_id
      WHERE tm_sensor_read.tenant_id = ?
      ORDER BY tm_sensor_read.read_date DESC
      LIMIT 15
    `;

    // Get latest alarms from tm_alarm (using same query as monitoring service)
    const alarmsQuery = `
      SELECT 
        'alert' as type,
        tm_alarm.alm_date as event_date,
        DATE_FORMAT(tm_alarm.alm_date, "%d/%m/%Y %H:%i:%s") as formatted_date,
        tr_alarm_code.alcode_note as alert_message,
        CASE 
          WHEN LOWER(tr_alarm_code.alcode_note) LIKE '%critical%' OR LOWER(tr_alarm_code.alcode_note) LIKE '%danger%' THEN 'critical'
          WHEN LOWER(tr_alarm_code.alcode_note) LIKE '%warning%' OR LOWER(tr_alarm_code.alcode_note) LIKE '%warn%' THEN 'warning'
          ELSE 'info'
        END as alert_type,
        tm_device.dev_name,
        td_device_sensor.ds_name,
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
      ORDER BY tm_alarm.alm_date DESC
      LIMIT 15
    `;

    const [readings, alarms] = await Promise.all([
      this.dataSource.query(readingsQuery, [tenantId]),
      this.dataSource.query(alarmsQuery, [tenantId]),
    ]);

    // Combine and sort by date
    const combined = [...readings, ...alarms].sort((a, b) => {
      return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
    });

    // Return top 20 items
    return combined.slice(0, 20);
  }

  async getSitesForMap(tenantId: string) {
    const sites = await this.siteRepository.find({
      where: { tenant_id: tenantId },
      select: [
        'site_id',
        'site_name',
        'site_type',
        'site_address',
        'site_lat',
        'site_lon',
      ],
    });

    return sites.map(site => ({
      site_id: site.site_id,
      site_name: site.site_name,
      site_type: site.site_type,
      site_address: site.site_address,
      site_lat: site.site_lat,
      site_long: site.site_lon, // Map site_lon to site_long for frontend consistency
    }));
  }

  async getSitesWithDevicesAndSensors(tenantId: string) {
    // Get sites with coordinates
    const sitesQuery = `
      SELECT site_id, site_name, site_type, site_address, site_lat, site_lon
      FROM tm_site
      WHERE tenant_id = ?
    `;
    const sites = await this.dataSource.query(sitesQuery, [tenantId]);

    // Query 1: Get device coordinates
    const devicesQuery = `
      SELECT dev_id, dev_name, dev_location, dev_lat, dev_lon
      FROM tm_device 
      WHERE tenant_id = ?
    `;
    const devices = await this.dataSource.query(devicesQuery, [tenantId]);

    // Query 2: Get sensor coordinates for all devices
    const sensorsQuery = `
      SELECT sens_id, dev_id, sens_name, sens_location, sens_lat, sens_lon
      FROM td_sensor 
      WHERE tenant_id = ?
    `;
    const sensors = await this.dataSource.query(sensorsQuery, [tenantId]);

    // Query 3: Get latest readings for all device sensors
    const readingsQuery = `
      SELECT 
        td_device_sensor.dev_id,
        td_device_sensor.sens_id,
        td_device_sensor.ds_id,
        td_device_sensor.ds_name,
        tm_sensor_read_update.read_update_date,
        tm_sensor_read_update.read_update_value,
        tr_unit.unit_name,
        tr_unit.unit_symbol
      FROM td_device_sensor 
      LEFT JOIN tm_sensor_read_update ON tm_sensor_read_update.ds_id = td_device_sensor.ds_id
      LEFT JOIN tr_unit ON tr_unit.unit_id = td_device_sensor.unit_id
      WHERE td_device_sensor.tenant_id = ? AND tm_sensor_read_update.tenant_id = ?
      ORDER BY td_device_sensor.sens_id, tm_sensor_read_update.read_update_date DESC
    `;
    const allReadings = await this.dataSource.query(readingsQuery, [tenantId, tenantId]);

    // Group readings by sens_id and ds_id, keep only latest
    const latestReadingsBySensor = new Map();
    allReadings.forEach(reading => {
      const key = `${reading.sens_id}_${reading.ds_id}`;
      if (!latestReadingsBySensor.has(key)) {
        latestReadingsBySensor.set(key, reading);
      }
    });

    // Group parameters by sens_id
    const parametersBySensor = new Map();
    Array.from(latestReadingsBySensor.values()).forEach(reading => {
      if (!parametersBySensor.has(reading.sens_id)) {
        parametersBySensor.set(reading.sens_id, []);
      }
      parametersBySensor.get(reading.sens_id).push({
        ds_id: reading.ds_id,
        ds_name: reading.ds_name,
        value: reading.read_update_value,
        date: reading.read_update_date,
        unit_symbol: reading.unit_symbol,
        unit_name: reading.unit_name,
      });
    });

    // Count sensors per device
    const sensorCountByDevice = new Map();
    sensors.forEach(sensor => {
      const count = sensorCountByDevice.get(sensor.dev_id) || 0;
      sensorCountByDevice.set(sensor.dev_id, count + 1);
    });

    return {
      sites: sites.map(site => ({
        site_id: site.site_id,
        site_name: site.site_name,
        site_type: site.site_type,
        site_address: site.site_address,
        site_lat: site.site_lat,
        site_lon: site.site_lon,
      })),
      devices: devices.map(device => ({
        dev_id: device.dev_id,
        dev_name: device.dev_name,
        dev_location: device.dev_location,
        dev_lat: device.dev_lat,
        dev_lon: device.dev_lon,
        sensor_count: sensorCountByDevice.get(device.dev_id) || 0,
      })),
      sensors: sensors.map(sensor => ({
        sens_id: sensor.sens_id,
        sens_name: sensor.sens_name,
        sens_location: sensor.sens_location,
        sens_lat: sensor.sens_lat,
        sens_lon: sensor.sens_lon,
        dev_id: sensor.dev_id,
        parameters: parametersBySensor.get(sensor.sens_id) || [],
      })),
    };
  }

  async generateSensorReadingsExcel(
    tenantId: string,
    startDate: string,
    endDate: string,
  ): Promise<Buffer> {
    // Query sensor readings with filters
    const query = `
      SELECT 
        tm_sensor_read.read_id,
        tm_sensor_read.read_date,
        tm_sensor_read.read_value,
        tm_device.dev_id,
        tm_device.dev_name,
        td_device_sensor.ds_id,
        td_device_sensor.ds_name,
        tr_unit.unit_name,
        tr_unit.unit_symbol,
        tm_site.site_name,
        tm_cluster.cluster_name
      FROM tm_sensor_read
      LEFT JOIN tm_device ON tm_device.dev_id = tm_sensor_read.dev_id
      LEFT JOIN td_device_sensor ON 
        td_device_sensor.ds_id = tm_sensor_read.ds_id 
        AND tm_sensor_read.dev_id = td_device_sensor.dev_id
      LEFT JOIN tr_unit ON tr_unit.unit_id = td_device_sensor.unit_id
      LEFT JOIN tm_cluster ON tm_cluster.cluster_id = tm_device.cluster_id
      LEFT JOIN tm_site ON tm_site.site_id = tm_cluster.site_id
      WHERE tm_sensor_read.tenant_id = ?
        AND tm_sensor_read.read_sts = 1
        AND DATE(tm_sensor_read.read_date) >= ?
        AND DATE(tm_sensor_read.read_date) <= ?
      ORDER BY tm_sensor_read.read_date DESC
    `;

    const readings = await this.dataSource.query(query, [
      tenantId,
      startDate,
      endDate,
    ]);

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sensor Readings');

    // Set column headers
    worksheet.columns = [
      { header: 'Read ID', key: 'read_id', width: 15 },
      { header: 'Date & Time', key: 'read_date', width: 20 },
      { header: 'Site', key: 'site_name', width: 20 },
      { header: 'Cluster', key: 'cluster_name', width: 20 },
      { header: 'Device ID', key: 'dev_id', width: 15 },
      { header: 'Device Name', key: 'dev_name', width: 25 },
      { header: 'Sensor ID', key: 'ds_id', width: 15 },
      { header: 'Sensor Name', key: 'ds_name', width: 25 },
      { header: 'Value', key: 'read_value', width: 15 },
      { header: 'Unit', key: 'unit_symbol', width: 10 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data rows
    readings.forEach((reading) => {
      worksheet.addRow({
        read_id: reading.read_id,
        read_date: reading.read_date,
        site_name: reading.site_name || '-',
        cluster_name: reading.cluster_name || '-',
        dev_id: reading.dev_id,
        dev_name: reading.dev_name,
        ds_id: reading.ds_id,
        ds_name: reading.ds_name,
        read_value: reading.read_value,
        unit_symbol: reading.unit_symbol || '',
      });
    });

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
