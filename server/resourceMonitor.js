// server/resourceMonitor.js
import { Meteor } from 'meteor/meteor';
import { ResourceLogs } from '../imports/api/resourceLogs';
import os from 'os';

export class ResourceMonitor {
  constructor(options = {}) {
    this.config = {
      interval: options.interval || 30000, // 30 seconds
      retentionDays: options.retentionDays || 7,
      alertThresholds: {
        cpu: options.cpuThreshold || 80,
        memory: options.memoryThreshold || 85,
        disk: options.diskThreshold || 90,
        containerCount: options.containerThreshold || 20
      },
      ...options
    };
    
    this.docker = options.docker;
    this.sessionManager = options.sessionManager;
    this.containerPool = options.containerPool;
    this.alerts = [];
    
    this.startMonitoring();
  }

  startMonitoring() {
    console.log('Starting resource monitoring...');
    
    // System metrics collection
    this.systemInterval = Meteor.setInterval(async () => {
      await this.collectSystemMetrics();
    }, this.config.interval);

    // Container metrics collection
    this.containerInterval = Meteor.setInterval(async () => {
      await this.collectContainerMetrics();
    }, this.config.interval);

    // Cleanup old data
    this.cleanupInterval = Meteor.setInterval(async () => {
      await this.cleanupOldData();
    }, 60 * 60 * 1000); // Every hour

    // Alert checking
    this.alertInterval = Meteor.setInterval(async () => {
      await this.checkAlerts();
    }, 60 * 1000); // Every minute
  }

  async collectSystemMetrics() {
    try {
      const metrics = await this.getSystemMetrics();
      
      await ResourceLogs.insertAsync({
        type: 'system',
        timestamp: new Date(),
        metrics: {
          cpu: metrics.cpu,
          memory: metrics.memory,
          disk: metrics.disk,
          network: metrics.network,
          uptime: metrics.uptime,
          loadAverage: metrics.loadAverage
        },
        metadata: {
          hostname: os.hostname(),
          platform: os.platform(),
          arch: os.arch()
        }
      });
    } catch (error) {
      console.error('Error collecting system metrics:', error);
    }
  }

  async collectContainerMetrics() {
    try {
      if (!this.docker) return;

      const containers = await this.docker.listContainers();
      const containerMetrics = [];

      for (const containerInfo of containers) {
        try {
          const container = this.docker.getContainer(containerInfo.Id);
          const stats = await container.stats({ stream: false });
          const inspect = await container.inspect();

          const metrics = this.parseContainerStats(stats, inspect);
          containerMetrics.push(metrics);
        } catch (error) {
          console.error(`Error getting stats for container ${containerInfo.Id}:`, error);
        }
      }

      if (containerMetrics.length > 0) {
        await ResourceLogs.insertAsync({
          type: 'containers',
          timestamp: new Date(),
          metrics: {
            totalContainers: containerMetrics.length,
            containers: containerMetrics,
            aggregated: this.aggregateContainerMetrics(containerMetrics)
          }
        });
      }

      // Collect pool metrics if available
      if (this.containerPool) {
        const poolStats = this.containerPool.getPoolStats();
        await ResourceLogs.insertAsync({
          type: 'pool',
          timestamp: new Date(),
          metrics: poolStats
        });
      }

      // Collect session metrics if available
      if (this.sessionManager) {
        const sessionStats = await this.sessionManager.getSessionStats();
        await ResourceLogs.insertAsync({
          type: 'sessions',
          timestamp: new Date(),
          metrics: sessionStats
        });
      }
    } catch (error) {
      console.error('Error collecting container metrics:', error);
    }
  }

  async getSystemMetrics() {
    // CPU Usage
    const cpuUsage = await this.getCPUUsage();
    
    // Memory Usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percentage: (usedMem / totalMem) * 100
    };

    // Disk Usage (basic)
    const diskUsage = await this.getDiskUsage();

    // Network (basic)
    const networkInterfaces = os.networkInterfaces();
    const network = {
      interfaces: Object.keys(networkInterfaces).length,
      details: networkInterfaces
    };

    return {
      cpu: cpuUsage,
      memory: memoryUsage,
      disk: diskUsage,
      network: network,
      uptime: os.uptime(),
      loadAverage: os.loadavg()
    };
  }

  async getCPUUsage() {
    return new Promise((resolve) => {
      const startMeasure = this.cpuAverage();
      
      setTimeout(() => {
        const endMeasure = this.cpuAverage();
        const idleDifference = endMeasure.idle - startMeasure.idle;
        const totalDifference = endMeasure.total - startMeasure.total;
        const percentage = 100 - ~~(100 * idleDifference / totalDifference);
        
        resolve({
          percentage,
          cores: os.cpus().length,
          loadAverage: os.loadavg()
        });
      }, 1000);
    });
  }

  cpuAverage() {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    
    for (const cpu of cpus) {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      idle += cpu.times.idle;
      irq += cpu.times.irq;
    }
    
    const total = user + nice + sys + idle + irq;
    return { idle, total };
  }

  async getDiskUsage() {
    // Basic disk usage - in production, use a more comprehensive solution
    try {
      const { execSync } = require('child_process');
      const output = execSync('df -h /', { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        return {
          total: parts[1],
          used: parts[2],
          available: parts[3],
          percentage: parseFloat(parts[4])
        };
      }
    } catch (error) {
      console.warn('Could not get disk usage:', error.message);
    }
    
    return { total: 'N/A', used: 'N/A', available: 'N/A', percentage: 0 };
  }

  parseContainerStats(stats, inspect) {
    // CPU Usage
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                    (stats.precpu_stats?.cpu_usage?.total_usage || 0);
    const systemDelta = stats.cpu_stats.system_cpu_usage - 
                       (stats.precpu_stats?.system_cpu_usage || 0);
    const cpuPercent = (cpuDelta / systemDelta) * 100;

    // Memory Usage
    const memoryUsage = stats.memory_stats.usage || 0;
    const memoryLimit = stats.memory_stats.limit || 0;
    const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

    // Network I/O
    const networks = stats.networks || {};
    let totalRxBytes = 0, totalTxBytes = 0;
    
    for (const network of Object.values(networks)) {
      totalRxBytes += network.rx_bytes || 0;
      totalTxBytes += network.tx_bytes || 0;
    }

    // Block I/O
    const blkio = stats.blkio_stats?.io_service_bytes_recursive || [];
    let totalRead = 0, totalWrite = 0;
    
    for (const io of blkio) {
      if (io.op === 'Read') totalRead += io.value;
      if (io.op === 'Write') totalWrite += io.value;
    }

    return {
      id: inspect.Id.substring(0, 12),
      name: inspect.Name.replace('/', ''),
      image: inspect.Config.Image,
      state: inspect.State.Status,
      created: inspect.Created,
      cpu: {
        percentage: cpuPercent || 0
      },
      memory: {
        usage: memoryUsage,
        limit: memoryLimit,
        percentage: memoryPercent
      },
      network: {
        rxBytes: totalRxBytes,
        txBytes: totalTxBytes
      },
      disk: {
        readBytes: totalRead,
        writeBytes: totalWrite
      }
    };
  }

  aggregateContainerMetrics(containerMetrics) {
    const total = {
      cpu: 0,
      memory: { usage: 0, limit: 0 },
      network: { rxBytes: 0, txBytes: 0 },
      disk: { readBytes: 0, writeBytes: 0 }
    };

    for (const container of containerMetrics) {
      total.cpu += container.cpu.percentage;
      total.memory.usage += container.memory.usage;
      total.memory.limit += container.memory.limit;
      total.network.rxBytes += container.network.rxBytes;
      total.network.txBytes += container.network.txBytes;
      total.disk.readBytes += container.disk.readBytes;
      total.disk.writeBytes += container.disk.writeBytes;
    }

    return {
      ...total,
      memory: {
        ...total.memory,
        percentage: total.memory.limit > 0 ? 
          (total.memory.usage / total.memory.limit) * 100 : 0
      }
    };
  }

  async checkAlerts() {
    try {
      const recentMetrics = await ResourceLogs.findOneAsync(
        { type: 'system' },
        { sort: { timestamp: -1 } }
      );

      if (!recentMetrics) return;

      const alerts = [];
      const { metrics } = recentMetrics;

      // CPU Alert
      if (metrics.cpu.percentage > this.config.alertThresholds.cpu) {
        alerts.push({
          type: 'cpu',
          level: 'warning',
          message: `High CPU usage: ${metrics.cpu.percentage.toFixed(1)}%`,
          value: metrics.cpu.percentage,
          threshold: this.config.alertThresholds.cpu
        });
      }

      // Memory Alert
      if (metrics.memory.percentage > this.config.alertThresholds.memory) {
        alerts.push({
          type: 'memory',
          level: 'warning',
          message: `High memory usage: ${metrics.memory.percentage.toFixed(1)}%`,
          value: metrics.memory.percentage,
          threshold: this.config.alertThresholds.memory
        });
      }

      // Disk Alert
      if (metrics.disk.percentage > this.config.alertThresholds.disk) {
        alerts.push({
          type: 'disk',
          level: 'critical',
          message: `High disk usage: ${metrics.disk.percentage}%`,
          value: metrics.disk.percentage,
          threshold: this.config.alertThresholds.disk
        });
      }

      // Container Count Alert
      const containerMetrics = await ResourceLogs.findOneAsync(
        { type: 'containers' },
        { sort: { timestamp: -1 } }
      );

      if (containerMetrics && 
          containerMetrics.metrics.totalContainers > this.config.alertThresholds.containerCount) {
        alerts.push({
          type: 'containers',
          level: 'warning',
          message: `High container count: ${containerMetrics.metrics.totalContainers}`,
          value: containerMetrics.metrics.totalContainers,
          threshold: this.config.alertThresholds.containerCount
        });
      }

      // Store new alerts
      for (const alert of alerts) {
        this.addAlert(alert);
      }

    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }

  addAlert(alert) {
    const alertWithTimestamp = {
      ...alert,
      timestamp: new Date(),
      id: Math.random().toString(36).substring(7)
    };

    this.alerts.unshift(alertWithTimestamp);
    
    // Keep only recent alerts
    this.alerts = this.alerts.slice(0, 100);

    console.warn(`ALERT [${alert.level.toUpperCase()}]: ${alert.message}`);
    
    // In production, you might want to send notifications here
    // this.sendNotification(alertWithTimestamp);
  }

  async cleanupOldData() {
    try {
      const cutoffDate = new Date(Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000));
      
      const result = await ResourceLogs.removeAsync({
        timestamp: { $lt: cutoffDate }
      });

      if (result > 0) {
        console.log(`Cleaned up ${result} old resource log entries`);
      }
    } catch (error) {
      console.error('Error cleaning up old resource data:', error);
    }
  }

  getRecentAlerts(limit = 20) {
    return this.alerts.slice(0, limit);
  }

  async getResourceSummary(hours = 24) {
    try {
      const since = new Date(Date.now() - (hours * 60 * 60 * 1000));
      
      const [systemMetrics, containerMetrics, sessionMetrics] = await Promise.all([
        ResourceLogs.find({ 
          type: 'system', 
          timestamp: { $gte: since } 
        }, { 
          sort: { timestamp: -1 }, 
          limit: 100 
        }).fetchAsync(),
        
        ResourceLogs.find({ 
          type: 'containers', 
          timestamp: { $gte: since } 
        }, { 
          sort: { timestamp: -1 }, 
          limit: 100 
        }).fetchAsync(),
        
        ResourceLogs.find({ 
          type: 'sessions', 
          timestamp: { $gte: since } 
        }, { 
          sort: { timestamp: -1 }, 
          limit: 100 
        }).fetchAsync()
      ]);

      return {
        period: `${hours} hours`,
        system: this.summarizeMetrics(systemMetrics, 'system'),
        containers: this.summarizeMetrics(containerMetrics, 'containers'),
        sessions: this.summarizeMetrics(sessionMetrics, 'sessions'),
        alerts: this.getRecentAlerts(10)
      };
    } catch (error) {
      console.error('Error getting resource summary:', error);
      return { error: error.message };
    }
  }

  summarizeMetrics(metrics, type) {
    if (metrics.length === 0) return { count: 0 };

    const latest = metrics[0];
    const oldest = metrics[metrics.length - 1];

    if (type === 'system') {
      return {
        count: metrics.length,
        latest: latest.metrics,
        period: {
          start: oldest.timestamp,
          end: latest.timestamp
        },
        averages: this.calculateAverages(metrics, ['cpu.percentage', 'memory.percentage'])
      };
    }

    return {
      count: metrics.length,
      latest: latest.metrics,
      period: {
        start: oldest.timestamp,
        end: latest.timestamp
      }
    };
  }

  calculateAverages(metrics, paths) {
    const averages = {};
    
    for (const path of paths) {
      const values = metrics.map(m => this.getNestedValue(m.metrics, path))
                           .filter(v => v !== undefined && !isNaN(v));
      
      if (values.length > 0) {
        averages[path] = values.reduce((sum, val) => sum + val, 0) / values.length;
      }
    }
    
    return averages;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  stop() {
    console.log('Stopping resource monitoring...');
    
    if (this.systemInterval) {
      Meteor.clearInterval(this.systemInterval);
    }
    
    if (this.containerInterval) {
      Meteor.clearInterval(this.containerInterval);
    }
    
    if (this.cleanupInterval) {
      Meteor.clearInterval(this.cleanupInterval);
    }
    
    if (this.alertInterval) {
      Meteor.clearInterval(this.alertInterval);
    }
    
    console.log('Resource monitoring stopped');
  }
}