import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { Server } from 'socket.io';
import { Client } from 'ssh2';
import { SessionLogs } from '../imports/api/sessions';
import { AuditLogs } from '../imports/api/auditLogs'; 
import Docker from 'dockerode';
import bodyParser from 'body-parser';
import './aichat.js';
import dotenv from 'dotenv';
import multiparty from 'multiparty';
import fs from 'fs';
import tar from 'tar-fs';
import path from 'path';

const result = dotenv.config();
console.log(result);

WebApp.connectHandlers.use(bodyParser.json());

const docker = new Docker({ host: 'localhost', port: 2375 });
let io;
const terminalSessions = new Map();

WebApp.connectHandlers.use('/api/import-dockerfile', async (req, res, next) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Method Not Allowed' }));
    return;
  }

  const form = new multiparty.Form();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Error parsing form:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Error parsing form data' }));
      return;
    }

    const dockerfile = files.dockerfile?.[0];
    const imageName = fields.imageName?.[0] || `custom-ssh-${Date.now()}`;
    const containerName = `container-${imageName}`;

    if (!dockerfile || !dockerfile.path) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Missing Dockerfile' }));
      return;
    }

    try {
      const dockerfileDir = path.dirname(dockerfile.path);
      const dockerfilePath = path.join(dockerfileDir, 'Dockerfile');
      fs.renameSync(dockerfile.path, dockerfilePath);

      const tarStream = tar.pack(dockerfileDir, {
        entries: ['Dockerfile']
      });

      const stream = await docker.buildImage(tarStream, { t: imageName });

      let output = '';
      stream.on('data', (chunk) => {
        output += chunk.toString();
        console.log('Docker build output:', chunk.toString());
      });

      stream.on('end', async () => {
        console.log(`Docker image built: ${imageName}`);
        
        // Now run the container after successful build
        try {
          const container = await docker.createContainer({
            Image: imageName,
            name: containerName
          });

          await container.start();
          console.log(`Container started: ${containerName}`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            containerName: containerName,
            imageName: imageName,
            status: 'running'
          }));
        } catch (runError) {
          console.error('Error running container:', runError);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            message: 'Image built but failed to run container',
            error: runError.message,
            imageName: imageName
          }));
        }
      });

      stream.on('error', (error) => {
        console.error('Docker build error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: error.message }));
      });

    } catch (err) {
      console.error('Unexpected error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: err.message }));
    }
  });
});


// API endpoint to stop and remove containers
WebApp.connectHandlers.use('/api/stop-container', async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const { containerId } = req.body;
    
    if (!containerId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Container ID is required' }));
      return;
    }

    console.log(`Attempting to stop container: ${containerId}`);
    
    // Get the container instance
    const container = docker.getContainer(containerId);
    
    // Check if container exists and is running
    const containerInfo = await container.inspect();
    
    if (!containerInfo.State.Running) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Container is not running' }));
      return;
    }

    // Stop the container
    await container.stop({ t: 10 }); // 10 second timeout
    console.log(`Container ${containerId} stopped successfully`);

    // Remove the container
    await container.remove();
    console.log(`Container ${containerId} removed successfully`);

    // Check if this container was part of an active SSH session and clean it up
    for (const [socketId, session] of terminalSessions) {
      if (session.containerId === containerId) {
        console.log(`Cleaning up SSH session for container ${containerId}`);
        
        // Close the SSH connection
        if (session.conn) {
          session.conn.end();
        }
        
        // Remove from active sessions
        terminalSessions.delete(socketId);
        
        // Notify client that session ended
        if (io) {
          io.to(socketId).emit('output', '\r\n\x1b[31mContainer stopped by administrator\x1b[0m\r\n');
          io.to(socketId).emit('disconnect');
        }
        
        break;
      }
    }

    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ 
      success: true, 
      message: `Container ${containerId} stopped and removed successfully`
    }));

  } catch (err) {
    console.error('Failed to stop container:', err.message);
    
    let statusCode = 500;
    let errorMessage = err.message;
    
    // Handle specific Docker errors
    if (err.statusCode === 404) {
      statusCode = 404;
      errorMessage = 'Container not found';
    } else if (err.statusCode === 304) {
      statusCode = 400;
      errorMessage = 'Container already stopped';
    }
    
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: errorMessage }));
  }
});

// API endpoint to get active containers
WebApp.connectHandlers.use('/api/active-containers', async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: false }); // running only
    const formatted = containers.map(c => ({
      id: c.Id,
      image: c.Image,
      name: c.Names?.[0]?.replace('/', ''),
      state: c.State,
      status: c.Status,
      created: c.Created,
      Ports: c.Ports // Include the Ports array
    }));

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(formatted));
  } catch (err) {
    console.error('Failed to fetch containers:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

// API endpoint to create new containers
WebApp.connectHandlers.use('/api/create-container', async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    console.log('Creating new SSH container...');
    
    // Create container 
    const containerName = `ssh-session-${Date.now()}`;
    const container = await docker.createContainer({
      Image: 'ssh-terminal',
      name: containerName,
      Tty: true,
      ExposedPorts: { '22/tcp': {} },
      HostConfig: { PortBindings: { '22/tcp': [{}] } }
    });

    await container.start();
    console.log(`Container ${containerName} created and started`);
    
    // Wait a moment for the container to fully start
    await new Promise(r => setTimeout(r, 500));
    
    // Get container details
    const data = await container.inspect();
    const mapped = data?.NetworkSettings?.Ports?.['22/tcp'];
    
    if (!mapped || !mapped[0]?.HostPort) {
      throw new Error('Could not retrieve mapped HostPort for SSH container');
    }

    const containerInfo = {
      id: container.id,
      name: containerName,
      host: 'localhost',
      port: parseInt(mapped[0].HostPort),
      image: 'ssh-terminal',
      status: 'Up',
      state: 'running',
      created: new Date().toISOString()
    };

    console.log(`Container created successfully: ${containerName} on port ${containerInfo.port}`);

    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ 
      success: true, 
      message: `Container ${containerName} created successfully`,
      containerName: containerName,
      containerInfo: containerInfo
    }));

  } catch (err) {
    console.error('Failed to create container:', err.message);
    
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: `Failed to create container: ${err.message}` 
    }));
  }
});

Meteor.startup(() => {
  // API endpoint for audit logs
  WebApp.connectHandlers.use('/api/audit-logs', async (req, res) => {
    try {
      const logs = await AuditLogs.find({}, {
        projection: { _id: 0 },
        sort: { connectedAt: -1 }
      }).fetch();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(logs));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch audit logs' }));
    }
  });

  // Initialize Socket.IO
  io = new Server(WebApp.httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    let sessionLog = [];

    // UPDATED: Enhanced startSession handler with port validation (timer removed)
    socket.on('startSession', async (credentials) => {
      const ip = socket.handshake.address || socket.conn.remoteAddress || 'unknown';

      // UPDATED: Validate port input
      if (!credentials.port || isNaN(credentials.port) || credentials.port < 1 || credentials.port > 65535) {
        socket.emit('output', '\r\n\x1b[31mError: Invalid port number. Please enter a valid port (1-65535)\x1b[0m\r\n');
        return;
      }

      // Validate other required fields
      if (!credentials.host || !credentials.host.trim()) {
        socket.emit('output', '\r\n\x1b[31mError: Host is required\x1b[0m\r\n');
        return;
      }

      if (!credentials.username || !credentials.username.trim()) {
        socket.emit('output', '\r\n\x1b[31mError: Username is required\x1b[0m\r\n');
        return;
      }

      if (!credentials.useKeyAuth && (!credentials.password || !credentials.password.trim())) {
        socket.emit('output', '\r\n\x1b[31mError: Password is required when not using key authentication\x1b[0m\r\n');
        return;
      }

      if (credentials.useKeyAuth && (!credentials.privateKey || !credentials.privateKey.trim())) {
        socket.emit('output', '\r\n\x1b[31mError: Private key is required when using key authentication\x1b[0m\r\n');
        return;
      }

      // Audit log: user connected
      try {
        await AuditLogs.insertAsync({
          socketId: socket.id,
          username: credentials.username || 'unknown',
          ip,
          connectedAt: new Date()
        });
      } catch (err) {
        console.error('Audit log insert error:', err);
      }

      try {
        // UPDATED: Use user-provided port directly
        console.log(`Attempting connection to ${credentials.host}:${credentials.port}`);

        const conn = new Client();
        const sessionStartTime = new Date();
        let sessionId;

        try {
          sessionId = await SessionLogs.insertAsync({
            socketId: socket.id,
            host: credentials.host,
            port: parseInt(credentials.port), // Use user-provided port
            username: credentials.username,
            startTime: sessionStartTime,
            status: 'connecting'
          });
        } catch (err) {
          console.error('Error inserting session log:', err);
          socket.emit('output', '\r\n\x1b[31mError: Could not start session\x1b[0m\r\n');
          return;
        }

        conn.on('ready', () => {
          SessionLogs.updateAsync(sessionId, { $set: { status: 'connected' } }).catch(console.error);

          terminalSessions.set(socket.id, {
            conn,
            stream: null,
            sessionId,
            sessionStartTime,
            containerId: null, // No specific container tracking needed
            cleanedUp: false
          });

          conn.shell((err, stream) => {
            if (err) {
              socket.emit('output', `\r\n\x1b[31mSSH Error: ${err.message}\x1b[0m\r\n`);
              SessionLogs.updateAsync(sessionId, {
                $set: { status: 'error', errorMessage: err.message }
              }).catch(console.error);
              return;
            }

            const session = terminalSessions.get(socket.id);
            session.stream = stream;

            socket.emit('sshConnected', {});

            stream.on('data', (data) => {
              const output = data.toString();
              socket.emit('output', output);
              if (sessionLog.length > 1000) sessionLog.shift();
              sessionLog.push({ type: 'output', data: output, timestamp: new Date() });
            });

            stream.stderr.on('data', (data) => {
              const error = data.toString();
              socket.emit('output', `\x1b[31m${error}\x1b[0m`);
              sessionLog.push({ type: 'error', data: error, timestamp: new Date() });
            });

            stream.on('close', async () => {
              socket.emit('output', '\r\n\x1b[33mSSH Connection closed.\x1b[0m\r\n');
              const endTime = new Date();
              const durationInSeconds = Math.floor((endTime - sessionStartTime) / 1000);
              await SessionLogs.updateAsync(sessionId, {
                $set: {
                  status: 'closed',
                  endTime,
                  duration: durationInSeconds,
                  logSummary: sessionLog.slice(-50)
                }
              }).catch(console.error);

              const session = terminalSessions.get(socket.id);
              if (session && !session.cleanedUp) {
                session.cleanedUp = true;
              }

              terminalSessions.delete(socket.id);
              conn.end();
            });

            socket.removeAllListeners('input');
            socket.on('input', (data) => {
              if (terminalSessions.has(socket.id)) {
                terminalSessions.get(socket.id).stream.write(data);
              }
            });
          });
        });

        conn.on('error', (err) => {
          console.error(`SSH Connection Error for ${socket.id}:`, err);
          socket.emit('output', `\r\n\x1b[31mSSH Connection Error: ${err.message}\x1b[0m\r\n`);
          SessionLogs.updateAsync(sessionId, {
            $set: { status: 'error', errorMessage: err.message, endTime: new Date() }
          }).catch(console.error);
        });

        try {
          // UPDATED: Use user-provided port in connection options
          const connectionOptions = {
            host: credentials.host,
            port: parseInt(credentials.port), // Use user-provided port
            username: credentials.username,
            readyTimeout: 30000,
            keepaliveInterval: 30000
          };

          if (credentials.useKeyAuth && credentials.privateKey) {
            connectionOptions.privateKey = credentials.privateKey;
            if (credentials.passphrase) connectionOptions.passphrase = credentials.passphrase;
          } else if (credentials.password) {
            connectionOptions.password = credentials.password;
          } else {
            throw new Error('No authentication method provided');
          }

          conn.connect(connectionOptions);
        } catch (error) {
          console.error(`SSH Connection Error for ${socket.id}:`, error);
          socket.emit('output', `\r\n\x1b[31mSSH Connection Error: ${error.message}\x1b[0m\r\n`);
          SessionLogs.updateAsync(sessionId, {
            $set: { status: 'error', errorMessage: error.message, endTime: new Date() }
          }).catch(console.error);
        }
      } catch (connectionError) {
        console.error('Connection error:', connectionError);
        socket.emit('output', `\r\n\x1b[31mConnection Error: ${connectionError.message}\x1b[0m\r\n`);
      }
    });

    socket.on('endSession', async () => {
      const session = terminalSessions.get(socket.id);
      if (session && !session.cleanedUp) {
        session.cleanedUp = true;
        
        if (session.conn) {
          session.conn.end();
        }
      }

      await AuditLogs.updateAsync({ socketId: socket.id }, { $set: { disconnectedAt: new Date() } }).catch(console.error);
      terminalSessions.delete(socket.id);
      socket.emit('output', '\r\n\x1b[33mSession closed by user.\x1b[0m\r\n');
    });

    socket.on('disconnect', async () => {
      const session = terminalSessions.get(socket.id);
      if (session && !session.cleanedUp) {
        session.cleanedUp = true;
        
        if (session.conn) {
          session.conn.end();
        }
      }

      await AuditLogs.updateAsync({ socketId: socket.id }, { $set: { disconnectedAt: new Date() } }).catch(console.error);
      terminalSessions.delete(socket.id);
    });
  });
});