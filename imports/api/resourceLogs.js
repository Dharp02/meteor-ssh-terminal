// imports/api/resourceLogs.js
import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

export const ResourceLogs = new Mongo.Collection('resourceLogs');

if (Meteor.isServer) {
  // Create indexes for better performance
  Meteor.startup(() => {
    ResourceLogs.createIndexAsync({ timestamp: -1 });
    ResourceLogs.createIndexAsync({ type: 1, timestamp: -1 });
    ResourceLogs.createIndexAsync({ 'metrics.cpu.percentage': 1 });
    ResourceLogs.createIndexAsync({ 'metrics.memory.percentage': 1 });
  });

  // Publications
  Meteor.publish('recentResourceLogs', function(type, limit = 50) {
    check(type, String);
    check(limit, Number);
    
    const query = type === 'all' ? {} : { type };
    
    return ResourceLogs.find(query, {
      sort: { timestamp: -1 },
      limit: Math.min(limit, 200) // Max 200 records
    });
  });

  Meteor.publish('resourceMetrics', function(hours = 24) {
    check(hours, Number);
    
    const since = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    return ResourceLogs.find({
      timestamp: { $gte: since }
    }, {
      sort: { timestamp: -1 },
      fields: {
        type: 1,
        timestamp: 1,
        'metrics.cpu.percentage': 1,
        'metrics.memory.percentage': 1,
        'metrics.totalContainers': 1,
        'metrics.activeSessions': 1
      }
    });
  });

  // Server methods with unique names
  Meteor.methods({
    async 'resourceLogs.getSystemHealth'() {
      const latest = await ResourceLogs.findOneAsync(
        { type: 'system' },
        { sort: { timestamp: -1 } }
      );

      if (!latest) {
        return { status: 'unknown', message: 'No system metrics available' };
      }

      const { metrics } = latest;
      const issues = [];

      // Check CPU
      if (metrics.cpu && metrics.cpu.percentage > 90) {
        issues.push({ type: 'cpu', level: 'critical', value: metrics.cpu.percentage });
      } else if (metrics.cpu && metrics.cpu.percentage > 75) {
        issues.push({ type: 'cpu', level: 'warning', value: metrics.cpu.percentage });
      }

      // Check Memory
      if (metrics.memory && metrics.memory.percentage > 95) {
        issues.push({ type: 'memory', level: 'critical', value: metrics.memory.percentage });
      } else if (metrics.memory && metrics.memory.percentage > 80) {
        issues.push({ type: 'memory', level: 'warning', value: metrics.memory.percentage });
      }

      // Check Disk
      if (metrics.disk && metrics.disk.percentage > 95) {
        issues.push({ type: 'disk', level: 'critical', value: metrics.disk.percentage });
      } else if (metrics.disk && metrics.disk.percentage > 85) {
        issues.push({ type: 'disk', level: 'warning', value: metrics.disk.percentage });
      }

      let status = 'healthy';
      if (issues.some(issue => issue.level === 'critical')) {
        status = 'critical';
      } else if (issues.some(issue => issue.level === 'warning')) {
        status = 'warning';
      }

      return {
        status,
        timestamp: latest.timestamp,
        metrics: metrics,
        issues: issues
      };
    },

    async 'resourceLogs.getMetricHistory'(type, metric, hours = 24) {
      check(type, String);
      check(metric, String);
      check(hours, Number);

      const since = new Date(Date.now() - (hours * 60 * 60 * 1000));
      
      const logs = await ResourceLogs.find({
        type,
        timestamp: { $gte: since }
      }, {
        sort: { timestamp: 1 },
        fields: {
          timestamp: 1,
          [`metrics.${metric}`]: 1
        }
      }).fetchAsync();

      return logs.map(log => ({
        timestamp: log.timestamp,
        value: getNestedValue(log.metrics, metric)
      })).filter(item => item.value !== undefined);
    },

    async 'resourceLogs.getTopContainers'(limit = 10) {
      check(limit, Number);

      const latest = await ResourceLogs.findOneAsync(
        { type: 'containers' },
        { sort: { timestamp: -1 } }
      );

      if (!latest || !latest.metrics.containers) {
        return [];
      }

      return latest.metrics.containers
        .sort((a, b) => (b.cpu?.percentage || 0) - (a.cpu?.percentage || 0))
        .slice(0, limit)
        .map(container => ({
          id: container.id,
          name: container.name,
          image: container.image,
          cpu: container.cpu?.percentage || 0,
          memory: container.memory?.percentage || 0,
          state: container.state
        }));
    },

    async 'resourceLogs.getAlerts'() {
      // Return recent alerts based on metrics
      const recentLogs = await ResourceLogs.find({
        timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
      }, {
        sort: { timestamp: -1 }
      }).fetchAsync();

      const alerts = [];

      for (const log of recentLogs) {
        if (log.type === 'system' && log.metrics) {
          const { metrics } = log;
          
          if (metrics.cpu && metrics.cpu.percentage > 85) {
            alerts.push({
              type: 'cpu',
              level: metrics.cpu.percentage > 95 ? 'critical' : 'warning',
              message: `High CPU usage: ${metrics.cpu.percentage.toFixed(1)}%`,
              timestamp: log.timestamp,
              value: metrics.cpu.percentage
            });
          }

          if (metrics.memory && metrics.memory.percentage > 90) {
            alerts.push({
              type: 'memory',
              level: metrics.memory.percentage > 98 ? 'critical' : 'warning',
              message: `High memory usage: ${metrics.memory.percentage.toFixed(1)}%`,
              timestamp: log.timestamp,
              value: metrics.memory.percentage
            });
          }
        }
      }

      // Remove duplicates and return most recent
      const uniqueAlerts = alerts.reduce((acc, alert) => {
        const key = `${alert.type}-${alert.level}`;
        if (!acc[key] || acc[key].timestamp < alert.timestamp) {
          acc[key] = alert;
        }
        return acc;
      }, {});

      return Object.values(uniqueAlerts).slice(0, 20);
    },

    async 'resourceLogs.getUsageTrends'(days = 7) {
      check(days, Number);

      const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
      
      // Aggregate data by hour for the specified period
      const pipeline = [
        {
          $match: {
            type: 'system',
            timestamp: { $gte: since }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$timestamp' },
              month: { $month: '$timestamp' },
              day: { $dayOfMonth: '$timestamp' },
              hour: { $hour: '$timestamp' }
            },
            avgCpu: { $avg: '$metrics.cpu.percentage' },
            avgMemory: { $avg: '$metrics.memory.percentage' },
            maxCpu: { $max: '$metrics.cpu.percentage' },
            maxMemory: { $max: '$metrics.memory.percentage' },
            count: { $sum: 1 },
            timestamp: { $first: '$timestamp' }
          }
        },
        {
          $sort: { timestamp: 1 }
        }
      ];

      const trends = await ResourceLogs.aggregate(pipeline).toArray();
      
      return trends.map(trend => ({
        timestamp: trend.timestamp,
        cpu: {
          average: trend.avgCpu || 0,
          peak: trend.maxCpu || 0
        },
        memory: {
          average: trend.avgMemory || 0,
          peak: trend.maxMemory || 0
        },
        dataPoints: trend.count
      }));
    },

    async 'resourceLogs.cleanup'(olderThanDays = 30) {
      check(olderThanDays, Number);
      
      // Only allow cleanup for admin users in production
      const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
      
      const result = await ResourceLogs.removeAsync({
        timestamp: { $lt: cutoffDate }
      });

      return { removed: result };
    },

    async 'resourceLogs.getSystemOverview'() {
      const [systemMetrics, containerMetrics, sessionMetrics] = await Promise.all([
        ResourceLogs.findOneAsync({ type: 'system' }, { sort: { timestamp: -1 } }),
        ResourceLogs.findOneAsync({ type: 'containers' }, { sort: { timestamp: -1 } }),
        ResourceLogs.findOneAsync({ type: 'sessions' }, { sort: { timestamp: -1 } })
      ]);

      const overview = {
        lastUpdated: new Date(),
        system: null,
        containers: null,
        sessions: null,
        status: 'unknown'
      };

      if (systemMetrics && systemMetrics.metrics) {
        overview.system = {
          cpu: systemMetrics.metrics.cpu?.percentage || 0,
          memory: systemMetrics.metrics.memory?.percentage || 0,
          disk: systemMetrics.metrics.disk?.percentage || 0,
          uptime: systemMetrics.metrics.uptime || 0,
          timestamp: systemMetrics.timestamp
        };
      }

      if (containerMetrics && containerMetrics.metrics) {
        overview.containers = {
          total: containerMetrics.metrics.totalContainers || 0,
          aggregated: containerMetrics.metrics.aggregated || {},
          timestamp: containerMetrics.timestamp
        };
      }

      if (sessionMetrics && sessionMetrics.metrics) {
        overview.sessions = {
          active: sessionMetrics.metrics.activeSessions || 0,
          total: sessionMetrics.metrics.totalSessions || 0,
          today: sessionMetrics.metrics.todaySessions || 0,
          timestamp: sessionMetrics.timestamp
        };
      }

      // Determine overall status
      if (overview.system) {
        const { cpu, memory, disk } = overview.system;
        if (cpu > 90 || memory > 95 || disk > 95) {
          overview.status = 'critical';
        } else if (cpu > 75 || memory > 80 || disk > 85) {
          overview.status = 'warning';
        } else {
          overview.status = 'healthy';
        }
      }

      return overview;
    }
  });

  // Helper function to get nested values
  function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// Client-side helpers
export const ResourceLogsHelpers = {
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  formatPercentage(value, decimals = 1) {
    return `${parseFloat(value || 0).toFixed(decimals)}%`;
  },

  getStatusColor(status) {
    const colors = {
      'healthy': '#2ecc71',
      'warning': '#f39c12',
      'critical': '#e74c3c',
      'unknown': '#95a5a6'
    };
    return colors[status] || colors.unknown;
  },

  getMetricColor(value, thresholds = { warning: 75, critical: 90 }) {
    if (value >= thresholds.critical) return '#e74c3c';
    if (value >= thresholds.warning) return '#f39c12';
    return '#2ecc71';
  },

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  },

  formatTimestamp(timestamp, format = 'short') {
    const date = new Date(timestamp);
    
    if (format === 'short') {
      return date.toLocaleTimeString();
    } else if (format === 'long') {
      return date.toLocaleString();
    } else {
      return date.toISOString();
    }
  },

  calculateTrend(data, key) {
    if (data.length < 2) return 'stable';
    
    const recent = data.slice(-5); // Last 5 data points
    const values = recent.map(item => this.getNestedValue(item, key));
    
    let increasing = 0;
    let decreasing = 0;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) increasing++;
      else if (values[i] < values[i - 1]) decreasing++;
    }
    
    if (increasing > decreasing) return 'increasing';
    if (decreasing > increasing) return 'decreasing';
    return 'stable';
  },

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
};