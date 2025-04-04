import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { Server } from 'socket.io';
import { WebApp } from 'meteor/webapp';
import { Client } from 'ssh2';

// MongoDB Collection (optional for storing terminal messages)
export const TerminalMessages = new Mongo.Collection('terminalMessages');

let io;
const terminalSessions = new Map();

Meteor.startup(() => {
    if (!WebApp.httpServer) {
        console.error('WebApp.httpServer is not available!');
        return;
    }

    // Attach socket.io to Meteor's HTTP server
    io = new Server(WebApp.httpServer, {
        cors: {
            origin: "*", // Allow all origins (adjust for security)
            methods: ["GET", "POST"]
        }
    });

    console.log("WebSocket server started on Meteor's HTTP Server");

    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);

        socket.on('startSession', () => {
            const conn = new Client();

            conn.on('ready', () => {
                console.log(`SSH Connection established for ${socket.id}`);

                conn.shell((err, stream) => {
                    if (err) {
                        socket.emit('output', `SSH Error: ${err.message}`);
                        return;
                    }

                    terminalSessions.set(socket.id, { conn, stream });

                    stream.on('data', (data) => {
                        console.log(`Data from SSH: ${data.toString()}`);
                        socket.emit('output', data.toString());
                    });

                    stream.stderr.on('data', (data) => {
                        console.log(`SSH Error: ${data.toString()}`);
                        socket.emit('output', `Error: ${data.toString()}`);
                    });

                    stream.on('close', () => {
                        console.log(`Session closed for ${socket.id}`);
                        socket.emit('output', '\r\nSession closed.\r\n');
                        terminalSessions.delete(socket.id);
                        conn.end();
                    });

                    socket.on('sendCommand', (command) => {
                        if (terminalSessions.has(socket.id)) {
                            terminalSessions.get(socket.id).stream.write(command + '\n');
                        } else {
                            socket.emit('output', 'No active session found.');
                        }
                    });

                    socket.on('disconnect', () => {
                        console.log(`Client disconnected: ${socket.id}`);
                        if (terminalSessions.has(socket.id)) {
                            terminalSessions.get(socket.id).conn.end();
                            terminalSessions.delete(socket.id);
                        }
                    });
                });
            });

            conn.on('error', (err) => {
                console.error(`SSH Connection Error for ${socket.id}:`, err);
                socket.emit('output', `SSH Connection Error: ${err.message}`);
            });

            conn.connect({
                host: "10.0.0.82", // Ubuntu VM IP
                port: 22, // Default SSH port
                username: "vboxuser",
                password: "changeme", // Change this to your actual password
            });
        });

        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
            if (terminalSessions.has(socket.id)) {
                terminalSessions.get(socket.id).conn.end();
                terminalSessions.delete(socket.id);
            }
        });
    });
});
