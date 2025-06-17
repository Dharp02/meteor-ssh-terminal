// server/sessionManager.js
import { Meteor } from 'meteor/meteor';
import { SessionLogs } from '../imports/api/sessions';
import { PersistentSessions } from '../imports/api/persistentSessions';
import Docker from 'dockerode';

export class SessionManager {
  constructor() {
    this.activeSessions = new Map();
    this.sessionTimeouts = new Map();
    this.docker = new Docker({ host: 'localhost', port: 2375 });
    this.restoreExistingSessions();
  }

  async createSession(socketId, credentials, userInfo = {}) {
    try {
      // Check for existing restorable session
      const existingSession = await this.findRestorableSession(userInfo.userId);
      
      if (existingSession) {
        return await this.restoreSession(socketId, existingSession);
      }

      // Create new session
      const sessionData = {
        socketId,
        userId: userInfo.userId || 'anonymous',
        userAgent: userInfo.userAgent,
        ipAddress: userInfo.ipAddress,
        credentials: this.sanitizeCredentials(credentials),
        createdAt: new Date(),
        status: 'creating',
        restoreKey: this.generateRestoreKey(),
        expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000)) // 24 hours
      };

      // Insert into persistent storage
      const sessionId = await PersistentSessions.insertAsync(sessionData);
      sessionData._id = sessionId;

      // Store in memory
      this.activeSessions.set(socketId, sessionData);

      return sessionData;
    } catch (error) {
      console.error('Session creation error:', error);
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  async attachContainer(sessionData, containerInfo) {
    try {
      const updatedData = {
        ...sessionData,
        containerId: containerInfo.id,
        containerName: containerInfo.name,
        hostPort: containerInfo.port,
        status: 'active',
        lastActivity: new Date()
      };

      // Update both memory and database
      this.activeSessions.set(sessionData.socketId, updatedData);
      await PersistentSessions.updateAsync(sessionData._id, {
        $set: {
          containerId: containerInfo.id,
          containerName: containerInfo.name,
          hostPort: containerInfo.port,
          status: 'active',
          lastActivity: new Date()
        }
      });

      // Set activity timeout
      this.setActivityTimeout(sessionData.socketId);

      return updatedData;
    } catch (error) {
      console.error('Container attachment error:', error);
      throw error;
    }
  }

  async restoreSession(newSocketId, existingSession) {
    try {
      // Verify container is still running
      const container = this.docker.getContainer(existingSession.containerId);
      const containerInfo = await container.inspect();
      
      if (containerInfo.State.Running) {
        // Update session with new socket
        const restoredSession = {
          ...existingSession,
          socketId: newSocketId,
          status: 'restored',
          lastActivity: new Date(),
          restoredAt: new Date()
        };

        this.activeSessions.set(newSocketId, restoredSession);
        await PersistentSessions.updateAsync(existingSession._id, {
          $set: {
            socketId: newSocketId,
            status: 'restored',
            lastActivity: new Date(),
            restoredAt: new Date()
          }
        });

        console.log(`Session restored for container: ${existingSession.containerId}`);
        return restoredSession;
      } else {
        // Container is not running, clean up session
        await this.cleanupSession(existingSession.socketId, existingSession);
        return null;
      }
    } catch (error) {
      console.error('Session restoration error:', error);
      // If container doesn't exist, clean up session
      await this.cleanupSession(existingSession.socketId, existingSession);
      return null;
    }
  }

  async findRestorableSession(userId) {
    if (!userId || userId === 'anonymous') return null;

    try {
      const recentSession = await PersistentSessions.findOneAsync({
        userId,
        status: { $in: ['active', 'disconnected'] },
        expiresAt: { $gt: new Date() },
        containerId: { $exists: true }
      }, {
        sort: { lastActivity: -1 }
      });

      return recentSession;
    } catch (error) {
      console.error('Error finding restorable session:', error);
      return null;
    }
  }

  setActivityTimeout(socketId, duration = 30 * 60 * 1000) { // 30 minutes default
    // Clear existing timeout
    if (this.sessionTimeouts.has(socketId)) {
      clearTimeout(this.sessionTimeouts.get(socketId));
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      console.log(`Session timeout for ${socketId}`);
      await this.handleInactiveSession(socketId);
    }, duration);

    this.sessionTimeouts.set(socketId, timeout);
  }

  updateActivity(socketId) {
    const session = this.activeSessions.get(socketId);
    if (session) {
      session.lastActivity = new Date();
      
      // Update database periodically (every 5 minutes)
      if (!session.lastDbUpdate || Date.now() - session.lastDbUpdate > 5 * 60 * 1000) {
        PersistentSessions.updateAsync(session._id, {
          $set: { lastActivity: new Date() }
        }).catch(console.error);
        session.lastDbUpdate = Date.now();
      }

      // Reset activity timeout
      this.setActivityTimeout(socketId);
    }
  }

  async handleInactiveSession(socketId) {
    const session = this.activeSessions.get(socketId);
    if (session) {
      // Mark as disconnected but keep container running
      session.status = 'disconnected';
      await PersistentSessions.updateAsync(session._id, {
        $set: { 
          status: 'disconnected',
          disconnectedAt: new Date()
        }
      });

      // Remove from active sessions but keep in database for restoration
      this.activeSessions.delete(socketId);
      this.sessionTimeouts.delete(socketId);
      
      console.log(`Session ${socketId} marked as inactive`);
    }
  }

  async cleanupSession(socketId, sessionData = null) {
    try {
      const session = sessionData || this.activeSessions.get(socketId);
      if (!session) return;

      // Stop and remove container
      if (session.containerId) {
        try {
          const container = this.docker.getContainer(session.containerId);
          await container.stop();
          await container.remove();
          console.log(`Container ${session.containerId} cleaned up`);
        } catch (containerError) {
          console.error('Container cleanup error:', containerError);
        }
      }

      // Update database
      if (session._id) {
        await PersistentSessions.updateAsync(session._id, {
          $set: {
            status: 'terminated',
            terminatedAt: new Date()
          }
        });
      }

      // Clear memory
      this.activeSessions.delete(socketId);
      if (this.sessionTimeouts.has(socketId)) {
        clearTimeout(this.sessionTimeouts.get(socketId));
        this.sessionTimeouts.delete(socketId);
      }

      console.log(`Session ${socketId} fully cleaned up`);
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }

  async restoreExistingSessions() {
    try {
      // Find sessions that were active when server restarted
      const orphanedSessions = await PersistentSessions.find({
        status: { $in: ['active', 'creating'] },
        expiresAt: { $gt: new Date() }
      }).fetchAsync();

      console.log(`Found ${orphanedSessions.length} orphaned sessions to clean up`);

      for (const session of orphanedSessions) {
        // Try to clean up containers from orphaned sessions
        if (session.containerId) {
          try {
            const container = this.docker.getContainer(session.containerId);
            const containerInfo = await container.inspect();
            
            if (containerInfo.State.Running) {
              // Container is still running, mark as disconnected for potential restoration
              await PersistentSessions.updateAsync(session._id, {
                $set: { status: 'disconnected' }
              });
            } else {
              // Container is stopped, mark as terminated
              await PersistentSessions.updateAsync(session._id, {
                $set: { status: 'terminated' }
              });
            }
          } catch (error) {
            // Container doesn't exist, mark as terminated
            await PersistentSessions.updateAsync(session._id, {
              $set: { status: 'terminated' }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error restoring existing sessions:', error);
    }
  }

  generateRestoreKey() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  sanitizeCredentials(credentials) {
    // Remove sensitive data for storage
    const sanitized = { ...credentials };
    delete sanitized.password;
    delete sanitized.privateKey;
    delete sanitized.passphrase;
    return sanitized;
  }

  getSessionInfo(socketId) {
    return this.activeSessions.get(socketId);
  }

  getAllActiveSessions() {
    return Array.from(this.activeSessions.values());
  }

  async getSessionStats() {
    const activeSessions = this.activeSessions.size;
    const totalSessions = await PersistentSessions.find().countAsync();
    const todaySessions = await PersistentSessions.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).countAsync();

    return {
      activeSessions,
      totalSessions,
      todaySessions,
      memoryUsage: process.memoryUsage()
    };
  }
}