// server/authMiddleware.js - Create this new file for authentication middleware
import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { AppUsers } from '../imports/api/users';

// Middleware to check authentication for API routes
export const requireAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  const sessionToken = req.headers['x-session-token'];

  if (!userId) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return;
  }

  // Verify user exists and is active
  AppUsers.findOneAsync({ _id: userId, isActive: true })
    .then(user => {
      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid user session' }));
        return;
      }

      // Add user to request object
      req.currentUser = user;
      next();
    })
    .catch(error => {
      console.error('Auth middleware error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Authentication error' }));
    });
};

// Apply authentication middleware to protected routes
WebApp.connectHandlers.use('/api/create-container', requireAuth);
WebApp.connectHandlers.use('/api/stop-container', requireAuth);
WebApp.connectHandlers.use('/api/active-containers', requireAuth);
WebApp.connectHandlers.use('/api/audit-logs', requireAuth);

// Enhanced Socket.IO authentication
export const authenticateSocket = async (socket, next) => {
  try {
    const userId = socket.handshake.auth?.userId;
    const sessionToken = socket.handshake.auth?.sessionToken;

    if (!userId) {
      return next(new Error('Authentication required'));
    }

    const user = await AppUsers.findOneAsync({ 
      _id: userId, 
      isActive: true 
    });

    if (!user) {
      return next(new Error('Invalid user session'));
    }

    // Add user info to socket
    socket.currentUser = user;
    socket.userId = userId;
    
    console.log(`Socket authenticated for user: ${user.username} (${user.role})`);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};