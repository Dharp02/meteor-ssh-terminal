import { Meteor } from 'meteor/meteor';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import { FitAddon } from 'xterm-addon-fit';
import io from 'socket.io-client';

Meteor.startup(() => {
    // Connect to WebSocket server
    const socket = io('http://localhost:3000');

    // Initialize Xterm.js terminal
    const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        theme: {
            background: '#000000',
            foreground: '#ffffff'
        }
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Attach terminal to the DOM
    const terminalContainer = document.createElement('div');
    terminalContainer.id = 'terminal-container';
    document.body.appendChild(terminalContainer);
    terminal.open(terminalContainer);
    fitAddon.fit();

    // Start SSH session when connected
    socket.emit('startSession');

    // Handle incoming SSH output
    socket.on('output', (message) => {
        terminal.write(`\r\n${message}`);
    });

    let commandBuffer = "";

    // Capture user input
    terminal.onData(data => {
        if (data === '\r') { // Enter key
            terminal.write('\r\n');
            socket.emit('sendCommand', commandBuffer);
            commandBuffer = "";
        } else if (data === '\x7F') { // Backspace key
            if (commandBuffer.length > 0) {
                commandBuffer = commandBuffer.slice(0, -1);
                terminal.write('\b \b');
            }
        } else {
            commandBuffer += data;
            terminal.write(data);
        }
    });
});
