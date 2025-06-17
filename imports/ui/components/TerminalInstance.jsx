import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import io from 'socket.io-client';
import 'xterm/css/xterm.css';

const TerminalInstance = ({ tabId }) => {
  const terminalRef = useRef(null);
  const term = useRef(null);
  const fitAddon = useRef(new FitAddon());
  const socket = useRef(null);
  const [remainingTime, setRemainingTime] = useState(null);
  const [logData, setLogData] = useState('');

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
    // Terminal initialization with proper scrollback settings
    term.current = new Terminal({
      fontSize: 14,
      cursorBlink: true,
      disableStdin: false,
      scrollback: 5000, // Scrollback buffer
      theme: { background: '#1e1e1e', foreground: '#ffffff' },
      scrollOnUserInput: true,
      fastScrollSensitivity: 5,
      scrollSensitivity: 1,
      convertEol: true,
      allowTransparency: false
    });

    term.current.loadAddon(fitAddon.current);
    term.current.open(terminalRef.current);
    term.current.focus();
    term.current.writeln('New Terminal Instance');

    // Force fit after terminal 
    setTimeout(() => {
      if (term.current && fitAddon.current) {
        fitAddon.current.fit();
      }
    }, 100);

    const resizeObserver = new ResizeObserver(() => {
      try {
        if (terminalRef.current?.offsetWidth > 0 && terminalRef.current?.offsetHeight > 0) {
          fitAddon.current.fit();
        }
      } catch (err) {
        console.warn('fit() failed:', err.message);
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    socket.current = io(window.location.origin);

    socket.current.on('connect', () => {
      term.current.writeln('\x1b[32mConnected to WebSocket server\x1b[0m');
    });

    socket.current.on('output', data => {
      term.current.write(data);
      setLogData(prev => prev + data);
    });

    socket.current.on('sshConnected', (data) => {
      console.log(' sshConnected received');
      term.current.writeln('\x1b[32mSSH Connection established\x1b[0m');
      if (data.remainingTime) {
        setRemainingTime(Math.floor(data.remainingTime / 1000));
      }
    });

    term.current.onData(data => {
      socket.current.emit('input', data);
    });

    return () => {
      socket.current.emit('endSession');
      socket.current.disconnect();
      term.current.dispose();
      resizeObserver.disconnect();
    };
  }, [tabId]);

  //Timer logic
  useEffect(() => {
    if (remainingTime === null) return;
    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev > 0) return prev - 1;
        clearInterval(timer);
        return 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [remainingTime]);

  const connectSSH = () => {
    const port = serverInfo.port || 22;

    term.current.writeln(`\x1b[33mConnecting to ${serverInfo.host}:${port} as ${serverInfo.username}...\x1b[0m`);
    socket.current.emit('startSession', {
      host: serverInfo.host,
      port,
      username: serverInfo.username,
      useKeyAuth: serverInfo.useKeyAuth,
      password: !serverInfo.useKeyAuth ? serverInfo.password : undefined,
      privateKey: serverInfo.useKeyAuth ? serverInfo.privateKey : undefined,
      passphrase: serverInfo.useKeyAuth ? serverInfo.passphrase : undefined
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setServerInfo(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const downloadLog = () => {
    const blob = new Blob([logData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${tabId}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearTerminal = () => {
    term.current.clear();
    setLogData('');
  };

  return (
    <>
      {/* Fixed Terminal Header (connection form) */}
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
        <button onClick={downloadLog}>Download Log</button>
        <button onClick={clearTerminal}>Clear</button>
        
        {/* Session Timer */}
        {remainingTime !== null && (
          <div style={{
            color: '#0f0',
            fontSize: '12px',
            fontFamily: 'monospace',
            background: '#111',
            padding: '2px 6px',
            borderRadius: '4px',
            marginLeft: 'auto'
          }}>
             {remainingTime}s remaining
          </div>
        )}
      </div>

      {/* Scrollable Terminal Instance - ONLY THIS PART SCROLLS */}
      <div
        className="terminal-instance"
        ref={terminalRef}
      />
    </>
  );
};

export default TerminalInstance;