// @ts-nocheck
import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';

// Create MongoDB collection for session logs
export const SessionLogs = new Mongo.Collection('sessionLogs');

if (Meteor.isServer) {
  // Set up publications for client access
  Meteor.publish('recentSessionLogs', function() {
    return SessionLogs.find({}, {
      sort: { startTime: -1 },
      limit: 50,
      fields: {
        host: 1,
        username: 1,
        startTime: 1,
        endTime: 1,
        status: 1,
        duration: 1
        // Don't include logs or sensitive data
      }
    });
  });

  // Server-side methods
  Meteor.methods({
    async 'sessions.clear'() {
      // Optional method to clear old sessions
      // You might want to add authentication here
      return await SessionLogs.removeAsync({ 
        startTime: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
      });
    },

    async 'sessions.getStats'() {
      // Method to get session statistics
      const totalCount = await SessionLogs.find().countAsync();
      const activeCount = await SessionLogs.find({ 
        status: { $in: ['connected', 'connecting'] },
        startTime: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }).countAsync();

      const recentSessions = await SessionLogs.find(
        {}, 
        {
          sort: { startTime: -1 },
          limit: 5,
          fields: { 
            host: 1, 
            username: 1,
            startTime: 1,
            status: 1
          }
        }
      ).fetchAsync();

      return {
        totalCount,
        activeCount,
        recentSessions
      };
    }
  });
}

  export function getSessionStatusClass(status) {
    switch (status) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'warning';
      case 'error':
      case 'disconnected':
        return 'danger';
      case 'closed':
        return 'info';
      default:
        return 'secondary';
    }
  }
