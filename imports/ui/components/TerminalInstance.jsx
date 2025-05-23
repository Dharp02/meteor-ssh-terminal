// TerminalInstance.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import io from 'socket.io-client';
import 'xterm/css/xterm.css';

const TerminalInstance = ({ tabId, label, onRename }) => {
  const terminalRef = useRef(null);
  const term = useRef(null);
  const fitAddon = useRef(new FitAddon());
  const socket = useRef(null);

  const [serverInfo, setServerInfo] = useState({
    host: 'localhost',
    port: 22,
    username: 'root',
    password: '',
    useKeyAuth: false,
    privateKey: '',
    passphrase: ''
  });

  useEffect(() => {
    term.current = new Terminal({
      fontSize: 14,
      cursorBlink: true,
      disableStdin: false,
      scrollback: 5000,
      theme: { background: '#1e1e1e', foreground: '#ffffff' }
    });

    term.current.loadAddon(fitAddon.current);
    term.current.open(terminalRef.current);
    fitAddon.current.fit();
    term.current.focus();

    term.current.writeln('New Terminal Instance');

    socket.current = io(window.location.origin);

    socket.current.on('connect', () => {
      term.current.writeln('\x1b[32mConnected to WebSocket server\x1b[0m');
    });

    socket.current.on('output', data => {
      term.current.write(data);
    });

    socket.current.on('sshConnected', () => {
      term.current.writeln('\x1b[32mSSH Connection established\x1b[0m');
    });

    term.current.onData(data => {
      socket.current.emit('input', data);
    });

    return () => {
      socket.current.emit('endSession');
      socket.current.disconnect();
      term.current.dispose();
    };
  }, [tabId]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setServerInfo(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const connectSSH = () => {
    const port = parseInt(serverInfo.port, 10) || 22;
    term.current.writeln(`\x1b[33mConnecting to ${serverInfo.host}:${port} as ${serverInfo.username}...\x1b[0m`);

    socket.current.emit('startSession', {
      host: serverInfo.host,
      port: port,
      username: serverInfo.username,
      useKeyAuth: serverInfo.useKeyAuth,
      password: !serverInfo.useKeyAuth ? serverInfo.password : undefined,
      privateKey: serverInfo.useKeyAuth ? serverInfo.privateKey : undefined,
      passphrase: serverInfo.useKeyAuth ? serverInfo.passphrase : undefined
    });
  };

  return (
    <div>
      <div className="terminal-header">
        <input type="text" name="host" placeholder="Host" value={serverInfo.host} onChange={handleInputChange} />
        <input type="number" name="port" placeholder="Port" value={serverInfo.port} onChange={handleInputChange} />
        <input type="text" name="username" placeholder="Username" value={serverInfo.username} onChange={handleInputChange} />
        <label>
          <input type="checkbox" name="useKeyAuth" checked={serverInfo.useKeyAuth} onChange={handleInputChange} /> Use SSH Key
        </label>
        {!serverInfo.useKeyAuth ? (
          <input type="password" name="password" placeholder="Password" value={serverInfo.password} onChange={handleInputChange} />
        ) : (
          <>
            <textarea name="privateKey" placeholder="Private Key" value={serverInfo.privateKey} onChange={handleInputChange}></textarea>
            <input type="password" name="passphrase" placeholder="Passphrase" value={serverInfo.passphrase} onChange={handleInputChange} />
          </>
        )}
        <button onClick={connectSSH}>Connect</button>
      </div>
      <div className="terminal-instance" ref={terminalRef} style={{ height: '400px', width: '100%', background: '#000' }}></div>
    </div>
  );
};

export default TerminalInstance;
