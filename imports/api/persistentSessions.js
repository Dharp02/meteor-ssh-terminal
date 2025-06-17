// imports/api/persistentSessions.js
import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

export const PersistentSessions = new Mongo.Collection('persistentSessions');

if (Meteor.isServer) {
  // Create indexes for better performance
  Meteor.startup(() => {
    PersistentSessions.createIndexAsync({ userId: 1, status: 1 });
    PersistentSessions.createIndexAsync({ expiresAt: 1 });
    PersistentSessions.createIndexAsync({ socketId: 1 });
    PersistentSessions.createIndexAsync({ containerId: 1 });
    PersistentSessions.createIndexAsync({ restoreKey: 1 });
  });

  // Publications
  Meteor.publish('userPersistentSessions', function(userId) {
    if (!userId) return this.ready();
    
    return PersistentSessions.find({
      userId,
      expiresAt: { $gt: new Date() }
    }, {
      fields: {
        _id: 1,
        socketId: 1,
        status: 1,
        createdAt: 1,
        lastActivity: 1,
        containerName: 1,
        hostPort: 1,
        credentials: 1 // Only non-sensitive parts
      },
      sort: { lastActivity: -1 },
      limit: 10
    });
  });

  Meteor.publish('persistentSessionStats', function() {
    // Publish aggregated stats (admin only in production)
    return PersistentSessions.find({}, {
      fields: {
        status: 1,
        createdAt: 1,
        userId: 1
      }
    });
  });

  // Server methods with unique names
  Meteor.methods({
    async 'persistentSessions.restore'(restoreKey, newSocketId) {
      check(restoreKey, String);
      check(newSocketId, String);
      
      const session = await PersistentSessions.findOneAsync({
        restoreKey,
        expiresAt: { $gt: new Date() },
        status: { $in: ['disconnected', 'active'] }
      });

      if (!session) {
        throw new Meteor.Error('session-not-found', 'Session not found or expired');
      }

      // Update with new socket ID
      await PersistentSessions.updateAsync(session._id, {
        $set: {
          socketId: newSocketId,
          status: 'restoring',
          lastActivity: new Date()
        }
      });

      return {
        sessionId: session._id,
        containerId: session.containerId,
        containerName: session.containerName,
        hostPort: session.hostPort,
        credentials: session.credentials
      };
    },

    async 'persistentSessions.cleanup'(olderThanDays = 7) {
      // Clean up old sessions (admin method)
      const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
      
      const result = await PersistentSessions.removeAsync({
        $or: [
          { expiresAt: { $lt: new Date() } },
          { 
            status: { $in: ['terminated', 'error'] },
            createdAt: { $lt: cutoffDate }
          }
        ]
      });

      return { removed: result };
    },

    async 'persistentSessions.getUserSessions'(userId) {
      check(userId, String);
      
      return await PersistentSessions.find({
        userId,
        expiresAt: { $gt: new Date() }
      }, {
        fields: {
          _id: 1,
          status: 1,
          createdAt: 1,
          lastActivity: 1,
          containerName: 1,
          credentials: 1
        },
        sort: { lastActivity: -1 }
      }).fetchAsync();
    },

    async 'persistentSessions.terminate'(sessionId) {
      check(sessionId, String);
      
      const session = await PersistentSessions.findOneAsync(sessionId);
      if (!session) {
        throw new Meteor.Error('session-not-found', 'Session not found');
      }

      // This method just marks as terminated
      // Actual cleanup happens in SessionManager
      await PersistentSessions.updateAsync(sessionId, {
        $set: {
          status: 'terminated',
          terminatedAt: new Date()
        }
      });

      return { success: true };
    },

    async 'persistentSessions.getStats'() {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        totalSessions,
        activeSessions,
        todaySessions,
        weekSessions
      ] = await Promise.all([
        PersistentSessions.find().countAsync(),
        PersistentSessions.find({ 
          status: { $in: ['active', 'connected'] } 
        }).countAsync(),
        PersistentSessions.find({ 
          createdAt: { $gte: dayAgo } 
        }).countAsync(),
        PersistentSessions.find({ 
          createdAt: { $gte: weekAgo } 
        }).countAsync()
      ]);

      // Status breakdown
      const statusStats = await PersistentSessions.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]).toArray();

      return {
        totalSessions,
        activeSessions,
        todaySessions,
        weekSessions,
        statusBreakdown: statusStats
      };
    },

    async 'persistentSessions.getUsageTrends'(days = 7) {
      check(days, Number);

      const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
      
      // Aggregate data by hour for the specified period
      const pipeline = [
        {
          $match: {
            createdAt: { $gte: since }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
              hour: { $hour: '$createdAt' }
            },
            sessionCount: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            timestamp: { $first: '$createdAt' }
          }
        },
        {
          $project: {
            timestamp: 1,
            sessionCount: 1,
            uniqueUserCount: { $size: '$uniqueUsers' }
          }
        },
        {
          $sort: { timestamp: 1 }
        }
      ];

      const trends = await PersistentSessions.aggregate(pipeline).toArray();
      
      return trends.map(trend => ({
        timestamp: trend.timestamp,
        sessions: trend.sessionCount,
        uniqueUsers: trend.uniqueUserCount
      }));
    },

    async 'persistentSessions.getSystemOverview'() {
      const [recentSessions, statusBreakdown] = await Promise.all([
        PersistentSessions.find({}, {
          sort: { createdAt: -1 },
          limit: 10,
          fields: {
            status: 1,
            createdAt: 1,
            userId: 1,
            containerName: 1,
            lastActivity: 1
          }
        }).fetchAsync(),
        
        PersistentSessions.aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]).toArray()
      ]);

      const overview = {
        lastUpdated: new Date(),
        recentSessions,
        statusBreakdown,
        totalSessions: await PersistentSessions.find().countAsync(),
        activeSessions: await PersistentSessions.find({
          status: { $in: ['active', 'connected'] }
        }).countAsync()
      };

      return overview;
    }
  });

  // Cleanup expired sessions periodically
  Meteor.setInterval(async () => {
    try {
      const expired = await PersistentSessions.find({
        expiresAt: { $lt: new Date() },
        status: { $nin: ['terminated', 'cleaned'] }
      }).fetchAsync();

      for (const session of expired) {
        // Mark as expired for cleanup
        await PersistentSessions.updateAsync(session._id, {
          $set: { status: 'expired' }
        });
      }

      if (expired.length > 0) {
        console.log(`Marked ${expired.length} persistent sessions as expired`);
      }
    } catch (error) {
      console.error('Error in persistent session cleanup job:', error);
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

// Helper functions
export const PersistentSessionHelpers = {
  getStatusColor(status) {
    const colors = {
      'active': '#2ecc71',
      'connected': '#2ecc71', 
      'disconnected': '#f39c12',
      'creating': '#3498db',
      'restoring': '#3498db',
      'terminated': '#95a5a6',
      'error': '#e74c3c',
      'expired': '#e67e22'
    };
    return colors[status] || '#95a5a6';
  },

  getStatusText(status) {
    const texts = {
      'active': 'Active',
      'connected': 'Connected',
      'disconnected': 'Disconnected',
      'creating': 'Creating...',
      'restoring': 'Restoring...',
      'terminated': 'Terminated',
      'error': 'Error',
      'expired': 'Expired'
    };
    return texts[status] || 'Unknown';
  },

  formatDuration(startTime, endTime = new Date()) {
    const duration = endTime - startTime;
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  },

  isSessionRestorable(session) {
    return session.status === 'disconnected' && 
           session.expiresAt > new Date() &&
           session.containerId;
  },

  getSessionAge(session) {
    const now = new Date();
    const created = new Date(session.createdAt);
    return this.formatDuration(created, now);
  }
};