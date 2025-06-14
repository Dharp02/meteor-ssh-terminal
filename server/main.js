import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { Server } from 'socket.io';
import { Client } from 'ssh2';
import { SessionLogs } from '../imports/api/sessions';
import { AuditLogs } from '../imports/api/auditLogs'; 
import Docker from 'dockerode';
import bodyParser from 'body-parser';

WebApp.connectHandlers.use(bodyParser.json());

const docker = new Docker({ host: 'localhost', port: 2375 });
let io;
const terminalSessions = new Map();

Meteor.startup(() => {
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


  io = new Server(WebApp.httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  async function createSSHContainer() {
    const containerName = `ssh-session-${Date.now()}`;
    const container = await docker.createContainer({
      Image: 'ssh-terminal',
      name: containerName,
      Tty: true,
      ExposedPorts: { '22/tcp': {} },
      HostConfig: { PortBindings: { '22/tcp': [{}] } }
    });

    await container.start();
    await new Promise(r => setTimeout(r, 300));
    const data = await container.inspect();
    const mapped = data?.NetworkSettings?.Ports?.['22/tcp'];
    if (!mapped || !mapped[0]?.HostPort) {
      throw new Error('Could not retrieve mapped HostPort for SSH container.');
    }

    return {
      id: container.id,
      name: containerName,
      host: 'localhost',
      port: mapped[0].HostPort
    };
  }

  function startAutoExpiry(socketId, durationMs = 10 * 60 * 1000) {
    const session = terminalSessions.get(socketId);
    if (!session) return;

    if (session.expiryTimeout) clearTimeout(session.expiryTimeout);

    session.expiryTimeout = setTimeout(async () => {
      if (terminalSessions.has(socketId)) {
        const { conn, containerId } = terminalSessions.get(socketId);
        try {
          const container = docker.getContainer(containerId);
          await container.stop();
          await container.remove();
        } catch (err) {
          console.error('Auto-expiry cleanup error:', err);
        }
        conn.end();
        terminalSessions.delete(socketId);
        console.log(`Auto-expired and removed session ${socketId}`);
      }
    }, durationMs);

    return session.expiryTimeout;
  }

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    let sessionLog = [];

    socket.on('startSession', async (credentials) => {
      const ip = socket.handshake.address || socket.conn.remoteAddress || 'unknown';

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

      const containerInfo = await createSSHContainer();
      credentials.port = containerInfo.port;
      credentials.host = containerInfo.host;

      const conn = new Client();
      const sessionStartTime = new Date();
      let sessionId;

      try {
        sessionId = await SessionLogs.insertAsync({
          socketId: socket.id,
          host: credentials.host,
          port: credentials.port,
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

        const expiryTimeout = startAutoExpiry(socket.id);
        terminalSessions.set(socket.id, {
          conn,
          stream: null,
          sessionId,
          sessionStartTime,
          containerId: containerInfo.id,
          cleanedUp: false,
          expiryTimeout
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

          const remainingTime = session.expiryTimeout
            ? session.expiryTimeout._idleStart + session.expiryTimeout._idleTimeout - Date.now()
            : 10 * 60 * 1000;

          socket.emit('sshConnected', { remainingTime });

          stream.on('data', (data) => {
            const output = data.toString();
            socket.emit('output', output);
            if (sessionLog.length > 1000) sessionLog.shift();
            sessionLog.push({ type: 'output', data: output, timestamp: new Date() });
            startAutoExpiry(socket.id);
          });

          stream.stderr.on('data', (data) => {
            const error = data.toString();
            socket.emit('output', `\x1b[31m${error}\x1b[0m`);
            sessionLog.push({ type: 'error', data: error, timestamp: new Date() });
            startAutoExpiry(socket.id);
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
              if (session.expiryTimeout) clearTimeout(session.expiryTimeout);
              try {
                const container = docker.getContainer(session.containerId);
                await container.stop();
                await container.remove();
              } catch (err) {
                console.error('Cleanup error:', err);
              }
            }

            terminalSessions.delete(socket.id);
            conn.end();
          });

          socket.removeAllListeners('input');
          socket.on('input', (data) => {
            if (terminalSessions.has(socket.id)) {
              terminalSessions.get(socket.id).stream.write(data);
              startAutoExpiry(socket.id);
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
        const connectionOptions = {
          host: credentials.host,
          port: credentials.port || 22,
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
    });

    socket.on('endSession', async () => {
      const session = terminalSessions.get(socket.id);
      if (session && !session.cleanedUp) {
        session.cleanedUp = true;
        if (session.expiryTimeout) clearTimeout(session.expiryTimeout);
        try {
          const container = docker.getContainer(session.containerId);
          await container.stop();
          await container.remove();
        } catch (err) {
          console.error(`Cleanup error:`, err);
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
        if (session.expiryTimeout) clearTimeout(session.expiryTimeout);
        try {
          const container = docker.getContainer(session.containerId);
          await container.stop();
          await container.remove();
        } catch (err) {
          console.error(`Cleanup error:`, err);
        }
      }

      await AuditLogs.updateAsync({ socketId: socket.id }, { $set: { disconnectedAt: new Date() } }).catch(console.error);
      terminalSessions.delete(socket.id);
    });
  });
});
