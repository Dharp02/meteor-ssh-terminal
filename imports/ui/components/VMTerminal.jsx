import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import io from 'socket.io-client';
import 'xterm/css/xterm.css';

const VMTerminal = ({ onBack }) => {
  const terminalRef = useRef(null);
  const term = useRef(null);
  const fitAddon = useRef(new FitAddon());
  const socket = useRef(null);
  
  const [serverInfo, setServerInfo] = useState({
    host: '',
    port: 22,
    username: '',
    password: '',
    useKeyAuth: false,
    privateKey: '',
    passphrase: ''
  });
  
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Initialize terminal
    term.current = new Terminal({
      fontSize: 14,
      cursorBlink: true,
      disableStdin: false,
      scrollback: 5000,
      theme: { 
        background: '#1e1e1e', 
        foreground: '#ffffff',
        cursor: '#ffffff',
        selection: '#4d4d4d'
      },
      scrollOnUserInput: true,
      fastScrollSensitivity: 5,
      scrollSensitivity: 1,
      convertEol: true,
      allowTransparency: false
    });

    term.current.loadAddon(fitAddon.current);
    term.current.open(terminalRef.current);
    term.current.focus();
    
    // Welcome message
    term.current.writeln('\x1b[36m╭─────────────────────────────────────╮\x1b[0m');
    term.current.writeln('\x1b[36m│           VM SSH Terminal           │\x1b[0m');
    term.current.writeln('\x1b[36m╰─────────────────────────────────────╯\x1b[0m');
    term.current.writeln('');
    term.current.writeln('\x1b[33mEnter your SSH connection details above and click Connect.\x1b[0m');
    term.current.writeln('');

    // Fit terminal to container
    setTimeout(() => {
      if (term.current && fitAddon.current) {
        fitAddon.current.fit();
      }
    }, 100);

    // Handle window resize
    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    // Socket connection
    socket.current = io(window.location.origin);

    socket.current.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    socket.current.on('output', data => {
      if (term.current) {
        term.current.write(data);
      }
    });

    socket.current.on('sshConnected', () => {
      setConnectionStatus('SSH Connected');
      setIsConnected(true);
      setIsConnecting(false);
      term.current.writeln('\r\n\x1b[32m✓ SSH Connection established\x1b[0m\r\n');
    });

    socket.current.on('disconnect', () => {
      setConnectionStatus('Disconnected');
      setIsConnected(false);
      setIsConnecting(false);
      if (term.current) {
        term.current.writeln('\r\n\x1b[31m✗ Disconnected from server\x1b[0m');
      }
    });

    socket.current.on('error', (error) => {
      console.error('Socket error:', error);
      setIsConnecting(false);
      if (term.current) {
        term.current.writeln(`\r\n\x1b[31mConnection error: ${error.message}\x1b[0m\r\n`);
      }
    });

    // Handle terminal input
    term.current.onData(data => {
      if (socket.current && isConnected) {
        socket.current.emit('input', data);
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      if (socket.current) {
        socket.current.emit('endSession');
        socket.current.disconnect();
      }
      if (term.current) {
        term.current.dispose();
      }
    };
  }, [isConnected]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setServerInfo(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const validateForm = () => {
    const { host, username, password, privateKey, useKeyAuth, port } = serverInfo;
    
    if (!host.trim() || !username.trim()) {
      return false;
    }

    if (!port || port.toString().trim() === '') {
      return false;
    }

    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return false;
    }
    
    if (useKeyAuth && !privateKey.trim()) {
      return false;
    }
    
    if (!useKeyAuth && !password.trim()) {
      return false;
    }
    
    return true;
  };

  const connectSSH = () => {
    if (!socket.current || !validateForm()) {
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('Connecting...');

    const port = parseInt(serverInfo.port) || 22;
    
    term.current.writeln(`\r\n\x1b[33m→ Connecting to ${serverInfo.host}:${port} as ${serverInfo.username}...\x1b[0m`);

    socket.current.emit('startSession', {
      host: serverInfo.host,
      port,
      username: serverInfo.username,
      useKeyAuth: serverInfo.useKeyAuth,
      password: !serverInfo.useKeyAuth ? serverInfo.password : undefined,
      privateKey: serverInfo.useKeyAuth ? serverInfo.privateKey : undefined,
      passphrase: serverInfo.useKeyAuth ? serverInfo.passphrase : undefined,
      userAgent: navigator.userAgent,
      userId: `vm-user-${Date.now()}`
    });
  };

  const disconnectSSH = () => {
    if (socket.current) {
      socket.current.emit('endSession');
      setConnectionStatus('Disconnected');
      setIsConnected(false);
      setIsConnecting(false);
      
      if (term.current) {
        term.current.writeln('\r\n\x1b[33m✗ SSH session terminated by user\x1b[0m\r\n');
      }
    }
  };

  const clearTerminal = () => {
    if (term.current) {
      term.current.clear();
    }
  };

  return (
    <div className="vm-terminal-container">
      {/* Header with connection form */}
      <div className="vm-header">
        <div className="vm-header-left">
          <button className="back-button" onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Services
          </button>
          <div className="connection-status">
            <div className={`status-indicator ${isConnected ? 'connected' : isConnecting ? 'connecting' : 'disconnected'}`}></div>
            <span className="status-text">{connectionStatus}</span>
          </div>
        </div>
        
        <div className="connection-form">
          <div className="form-group">
            <input
              type="text"
              name="host"
              placeholder="Host"
              value={serverInfo.host}
              onChange={handleInputChange}
              disabled={isConnected}
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <input
              type="number"
              name="port"
              placeholder="Port"
              value={serverInfo.port}
              onChange={handleInputChange}
              disabled={isConnected}
              className="form-input port-input"
              min="1"
              max="65535"
            />
          </div>
          
          <div className="form-group">
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={serverInfo.username}
              onChange={handleInputChange}
              disabled={isConnected}
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <label className="auth-toggle">
              <input
                type="checkbox"
                name="useKeyAuth"
                checked={serverInfo.useKeyAuth}
                onChange={handleInputChange}
                disabled={isConnected}
              />
              SSH Key
            </label>
          </div>
          
          {!serverInfo.useKeyAuth ? (
            <div className="form-group">
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={serverInfo.password}
                onChange={handleInputChange}
                disabled={isConnected}
                className="form-input"
              />
            </div>
          ) : (
            <>
              <div className="form-group key-group">
                <textarea
                  name="privateKey"
                  placeholder="Private Key"
                  value={serverInfo.privateKey}
                  onChange={handleInputChange}
                  disabled={isConnected}
                  className="form-textarea"
                  rows="3"
                />
              </div>
              <div className="form-group">
                <input
                  type="password"
                  name="passphrase"
                  placeholder="Passphrase (optional)"
                  value={serverInfo.passphrase}
                  onChange={handleInputChange}
                  disabled={isConnected}
                  className="form-input"
                />
              </div>
            </>
          )}
          
          <div className="form-actions">
            {isConnected ? (
              <>
                <button
                  className="action-button disconnect-button"
                  onClick={disconnectSSH}
                >
                  Disconnect
                </button>
                <button
                  className="action-button clear-button"
                  onClick={clearTerminal}
                >
                  Clear
                </button>
              </>
            ) : (
              <button
                className="action-button connect-button"
                onClick={connectSSH}
                disabled={!validateForm() || isConnecting}
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Terminal */}
      <div className="vm-terminal-wrapper">
        <div 
          className="vm-terminal"
          ref={terminalRef}
        />
      </div>
    </div>
  );
};

export default VMTerminal;