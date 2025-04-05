import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { Server } from 'socket.io';
import { Client } from 'ssh2';
import { SessionLogs } from '../imports/api/sessions';

let io;
const terminalSessions = new Map();

Meteor.startup(() => {
    if (!WebApp.httpServer) {
        console.error('WebApp.httpServer is not available!');
        return;
    }

    io = new Server(WebApp.httpServer, {
        cors: {
            origin: "*", // For development only; restrict in production
            methods: ["GET", "POST"]
        }
    });

    console.log("WebSocket server started on Meteor's HTTP Server");

    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);
        let sessionLog = [];

        socket.on('startSession', async (credentials) => {
            if (!credentials || !credentials.host || !credentials.username) {
                socket.emit('output', '\r\n\x1b[31mError: Missing connection parameters\x1b[0m\r\n');
                return;
            }

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
                console.log(`SSH Connection established for ${socket.id}`);
                SessionLogs.updateAsync(sessionId, {
                    $set: { status: 'connected' }
                }).catch(err => console.error('Error updating session status:', err));
                
                socket.emit('sshConnected');

                conn.shell((err, stream) => {
                    if (err) {
                        socket.emit('output', `\r\n\x1b[31mSSH Error: ${err.message}\x1b[0m\r\n`);
                        SessionLogs.updateAsync(sessionId, {
                            $set: { 
                                status: 'error',
                                errorMessage: err.message
                            }
                        }).catch(err => console.error('Error updating session status:', err));
                        return;
                    }

                    terminalSessions.set(socket.id, { 
                        conn, 
                        stream, 
                        sessionId,
                        sessionStartTime
                    });

                    stream.on('data', (data) => {
                        const dataStr = data.toString();
                        socket.emit('output', dataStr);
                        if (sessionLog.length > 1000) sessionLog.shift();
                        sessionLog.push({
                            type: 'output',
                            data: dataStr,
                            timestamp: new Date()
                        });
                    });

                    stream.stderr.on('data', (data) => {
                        const errorStr = data.toString();
                        socket.emit('output', `\x1b[31m${errorStr}\x1b[0m`);
                        sessionLog.push({
                            type: 'error',
                            data: errorStr,
                            timestamp: new Date()
                        });
                    });

                    stream.on('close', () => {
                        console.log(`SSH Stream closed for ${socket.id}`);
                        socket.emit('output', '\r\n\x1b[33mSSH Connection closed.\x1b[0m\r\n');
                        const endTime = new Date();
                        const durationInSeconds = Math.floor((endTime - sessionStartTime) / 1000);
                        SessionLogs.updateAsync(sessionId, {
                            $set: { 
                                status: 'closed',
                                endTime: endTime,
                                duration: durationInSeconds,
                                logSummary: sessionLog.slice(-50)
                            }
                        }).catch(err => console.error('Error updating session log:', err));
                        if (terminalSessions.has(socket.id)) {
                            terminalSessions.delete(socket.id);
                        }
                        conn.end();
                    });

                    // ***** FIX: Remove any duplicate 'input' listeners before attaching new one *****
                    socket.removeAllListeners('input');

                    socket.on('input', (data) => {
                        if (terminalSessions.has(socket.id)) {
                            terminalSessions.get(socket.id).stream.write(data);
                            if (data === '\r' || data === '\n' || data === '\r\n') {
                                sessionLog.push({
                                    type: 'input',
                                    data: 'Command executed',
                                    timestamp: new Date()
                                });
                            }
                        }
                    });
                });
            });

            conn.on('error', (err) => {
                console.error(`SSH Connection Error for ${socket.id}:`, err);
                socket.emit('output', `\r\n\x1b[31mSSH Connection Error: ${err.message}\x1b[0m\r\n`);
                SessionLogs.updateAsync(sessionId, {
                    $set: { 
                        status: 'error',
                        errorMessage: err.message,
                        endTime: new Date()
                    }
                }).catch(err => console.error('Error updating session status:', err));
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
                    $set: { 
                        status: 'error',
                        errorMessage: error.message,
                        endTime: new Date()
                    }
                }).catch(err => console.error('Error updating session status:', err));
            }
        });

        socket.on('endSession', () => {
            if (terminalSessions.has(socket.id)) {
                const { conn, sessionId, sessionStartTime } = terminalSessions.get(socket.id);
                const endTime = new Date();
                const durationInSeconds = Math.floor((endTime - sessionStartTime) / 1000);
                SessionLogs.updateAsync(sessionId, {
                    $set: { 
                        status: 'closed',
                        endTime: endTime,
                        duration: durationInSeconds
                    }
                }).catch(err => console.error('Error updating session status:', err));
                conn.end();
                terminalSessions.delete(socket.id);
                socket.emit('output', '\r\n\x1b[33mSession closed by user.\x1b[0m\r\n');
            }
        });

        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
            if (terminalSessions.has(socket.id)) {
                const { conn, sessionId, sessionStartTime } = terminalSessions.get(socket.id);
                const endTime = new Date();
                const durationInSeconds = Math.floor((endTime - sessionStartTime) / 1000);
                SessionLogs.updateAsync(sessionId, {
                    $set: { 
                        status: 'disconnected',
                        endTime: endTime,
                        duration: durationInSeconds
                    }
                }).catch(err => console.error('Error updating session status:', err));
                conn.end();
                terminalSessions.delete(socket.id);
            }
        });
    });
});
