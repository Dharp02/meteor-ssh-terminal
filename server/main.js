// server/main.js
import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { Server } from 'socket.io';
import { Client } from 'ssh2';
import { SessionLogs } from '../imports/api/sessions';
import Docker from 'dockerode';
import bodyParser from 'body-parser';
WebApp.connectHandlers.use(bodyParser.json());


const docker = new Docker({ host: 'localhost', port: 2375 });
let io;
const terminalSessions = new Map();

Meteor.startup(() => {
  WebApp.connectHandlers.use(bodyParser.json());

  WebApp.connectHandlers.use('/api/active-containers', (req, res) => {
    const active = Array.from(terminalSessions.entries()).map(([socketId, session]) => ({
      socketId,
      containerId: session.containerId,
      sessionId: session.sessionId,
      startedAt: session.sessionStartTime
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(active));
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
      HostConfig: {
        PortBindings: {
          '22/tcp': [{}]
        }
      }
    });

    await container.start();
    await new Promise(resolve => setTimeout(resolve, 300));

    const data = await container.inspect();
    const mapped = data?.NetworkSettings?.Ports?.['22/tcp'];
    if (!mapped || !mapped[0] || !mapped[0].HostPort) {
      throw new Error(' Could not retrieve mapped HostPort for SSH container.');
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
        console.log(` Auto-expired and removed session ${socketId}`);
      }
    }, durationMs);
  }

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    let sessionLog = [];

    socket.on('startSession', async (credentials) => {
      const containerInfo = await createSSHContainer();
      credentials.port = containerInfo.port;
      credentials.host = containerInfo.host;

      const conn = new Client();
      let sessionStartTime = new Date();
      let sessionId;

      try {
        sessionId = await SessionLogs.insertAsync({
          socketId: socket.id,
          host: credentials.host,
          port: credentials.port || 22,
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
        socket.emit('sshConnected');

        conn.shell((err, stream) => {
          if (err) {
            socket.emit('output', `\r\n\x1b[31mSSH Error: ${err.message}\x1b[0m\r\n`);
            SessionLogs.updateAsync(sessionId, { $set: { status: 'error', errorMessage: err.message } }).catch(console.error);
            return;
          }

          terminalSessions.set(socket.id, {
            conn,
            stream,
            sessionId,
            sessionStartTime,
            containerId: containerInfo.id,
            cleanedUp: false
          });

          startAutoExpiry(socket.id);

          stream.on('data', (data) => {
            const dataStr = data.toString();
            socket.emit('output', dataStr);
            if (sessionLog.length > 1000) sessionLog.shift();
            sessionLog.push({ type: 'output', data: dataStr, timestamp: new Date() });
            startAutoExpiry(socket.id); // reset timer on activity
          });

          stream.stderr.on('data', (data) => {
            const errorStr = data.toString();
            socket.emit('output', `\x1b[31m${errorStr}\x1b[0m`);
            sessionLog.push({ type: 'error', data: errorStr, timestamp: new Date() });
            startAutoExpiry(socket.id); // reset timer on error output
          });

          stream.on('close', async () => {
            socket.emit('output', '\r\n\x1b[33mSSH Connection closed.\x1b[0m\r\n');
            const endTime = new Date();
            const durationInSeconds = Math.floor((endTime.getTime() - sessionStartTime.getTime()) / 1000);
            await SessionLogs.updateAsync(sessionId, {
              $set: { status: 'closed', endTime, duration: durationInSeconds, logSummary: sessionLog.slice(-50) }
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
                console.error(`Cleanup error:`, err);
              }
            }
            terminalSessions.delete(socket.id);
            conn.end();
          });

          socket.removeAllListeners('input');
          socket.on('input', (data) => {
            if (terminalSessions.has(socket.id)) {
              terminalSessions.get(socket.id).stream.write(data);
              startAutoExpiry(socket.id); // reset on user input
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
          if (credentials.passphrase) {
            connectionOptions.passphrase = credentials.passphrase;
          }
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
      terminalSessions.delete(socket.id);
    });
  });
});
