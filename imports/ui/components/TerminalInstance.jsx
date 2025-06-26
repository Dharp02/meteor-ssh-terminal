// imports/ui/components/TerminalInstance.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import io from 'socket.io-client';
import { Session } from 'meteor/session';
import 'xterm/css/xterm.css';

const TerminalInstance = ({ tabId, initialConnection }) => {
  const terminalRef = useRef(null);
  const term = useRef(null);
  const fitAddon = useRef(new FitAddon());
  const socket = useRef(null);
  const [logData, setLogData] = useState('');

  // UPDATED: Use initial connection if provided, otherwise use defaults
  const [serverInfo, setServerInfo] = useState({
    host: initialConnection?.host || 'localhost',
    port: initialConnection?.port || '', // Use provided port or empty string
    username: initialConnection?.username || 'root',
    password: initialConnection?.password || '',
    useKeyAuth: false,
    privateKey: '',
    passphrase: ''
  });

  // Get current user for authentication
  const getCurrentUser = () => {
    return Session.get('currentUser');
  };

  const getCurrentUserId = () => {
    return Session.get('currentUserId');
  };

  // Create authenticated socket connection
  const createAuthenticatedSocket = () => {
    const userId = getCurrentUserId();
    const user = getCurrentUser();
    
    if (!userId || !user) {
      throw new Error('User not authenticated');
    }

    return io(window.location.origin, {
      auth: {
        userId: userId,
        sessionToken: 'web-session',
        userInfo: {
          username: user.username,
          role: user.role,
          email: user.email
        }
      },
      forceNew: true,
      transports: ['websocket', 'polling']
    });
  };

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

    // Force fit after terminal initialization
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

    // Create authenticated socket connection
    try {
      socket.current = createAuthenticatedSocket();

      socket.current.on('connect', () => {
        const user = getCurrentUser();
        term.current.writeln(`\x1b[32mConnected to WebSocket server as ${user?.username}\x1b[0m`);
        
        // Auto-connect if initial connection info is provided
        if (initialConnection && initialConnection.port && initialConnection.password) {
          term.current.writeln('\x1b[33mAuto-connecting to container...\x1b[0m');
          setTimeout(() => {
            connectSSH();
          }, 1000);
        }
      });

      socket.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        term.current.writeln(`\x1b[31mConnection error: ${error.message}\x1b[0m`);
        
        // If authentication error, redirect to login
        if (error.message.includes('Authentication') || error.message.includes('auth')) {
          term.current.writeln('\x1b[31mAuthentication failed. Please login again.\x1b[0m');
          // Clear authentication and reload
          Session.set('currentUserId', null);
          Session.set('currentUser', null);
          setTimeout(() => window.location.reload(), 2000);
        }
      });

      socket.current.on('output', data => {
        term.current.write(data);
        setLogData(prev => prev + data);
      });

      socket.current.on('sshConnected', (data) => {
        console.log('SSH Connected event received');
        term.current.writeln('\x1b[32mSSH Connection established\x1b[0m');
        if (data.remainingTime) {
          const minutes = Math.floor(data.remainingTime / 60000);
          term.current.writeln(`\x1b[33mSession will expire in ${minutes} minutes\x1b[0m`);
        }
      });

      socket.current.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        term.current.writeln(`\x1b[31mDisconnected: ${reason}\x1b[0m`);
      });

      socket.current.on('error', (error) => {
        console.error('Socket error:', error);
        term.current.writeln(`\x1b[31mSocket error: ${error.message}\x1b[0m`);
      });

      term.current.onData(data => {
        if (socket.current && socket.current.connected) {
          socket.current.emit('input', data);
        }
      });

    } catch (error) {
      console.error('Failed to create authenticated socket:', error);
      term.current.writeln(`\x1b[31mAuthentication error: ${error.message}\x1b[0m`);
      term.current.writeln('\x1b[31mPlease refresh and login again.\x1b[0m');
    }

    return () => {
      if (socket.current) {
        socket.current.emit('endSession');
        socket.current.disconnect();
      }
      if (term.current) {
        term.current.dispose();
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [tabId, initialConnection]);

  // UPDATED: Enhanced connectSSH function with port validation and authentication
  const connectSSH = () => {
    const user = getCurrentUser();
    if (!user) {
      term.current.writeln('\x1b[31mError: User not authenticated\x1b[0m');
      return;
    }

    // Validate port input
    if (!serverInfo.port || serverInfo.port.toString().trim() === '') {
      term.current.writeln('\x1b[31mError: Port number is required\x1b[0m');
      return;
    }

    const port = parseInt(serverInfo.port);
    
    if (isNaN(port) || port < 1 || port > 65535) {
      term.current.writeln('\x1b[31mError: Please enter a valid port number (1-65535)\x1b[0m');
      return;
    }

    // Validate other required fields
    if (!serverInfo.host.trim()) {
      term.current.writeln('\x1b[31mError: Host is required\x1b[0m');
      return;
    }

    if (!serverInfo.username.trim()) {
      term.current.writeln('\x1b[31mError: Username is required\x1b[0m');
      return;
    }

    if (!serverInfo.useKeyAuth && !serverInfo.password.trim()) {
      term.current.writeln('\x1b[31mError: Password is required when not using key authentication\x1b[0m');
      return;
    }

    if (serverInfo.useKeyAuth && !serverInfo.privateKey.trim()) {
      term.current.writeln('\x1b[31mError: Private key is required when using key authentication\x1b[0m');
      return;
    }

    if (!socket.current || !socket.current.connected) {
      term.current.writeln('\x1b[31mError: Not connected to server\x1b[0m');
      return;
    }

    term.current.writeln(`\x1b[33mConnecting to ${serverInfo.host}:${port} as ${serverInfo.username}...\x1b[0m`);
    
    // Enhanced credentials with user context
    const credentials = {
      host: serverInfo.host,
      port: port,
      username: serverInfo.username,
      useKeyAuth: serverInfo.useKeyAuth,
      password: !serverInfo.useKeyAuth ? serverInfo.password : undefined,
      privateKey: serverInfo.useKeyAuth ? serverInfo.privateKey : undefined,
      passphrase: serverInfo.useKeyAuth ? serverInfo.passphrase : undefined,
      tabId: tabId,
      userAgent: navigator.userAgent,
      userId: user._id,
      userInfo: {
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: `${user.firstName} ${user.lastName}`
      }
    };

    socket.current.emit('startSession', credentials);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setServerInfo(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const downloadLog = () => {
    const user = getCurrentUser();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `session-${user?.username || 'user'}-${tabId}-${timestamp}.log`;
    
    const blob = new Blob([logData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearTerminal = () => {
    term.current.clear();
    setLogData('');
  };

  const disconnectSSH = () => {
    if (socket.current) {
      socket.current.emit('endSession');
      term.current.writeln('\x1b[33mDisconnecting SSH session...\x1b[0m');
    }
  };

  return (
    <>
      {/* Fixed Terminal Header (connection form) */}
      <div className="terminal-header">
        <input 
          type="text" 
          name="host" 
          placeholder="Host" 
          value={serverInfo.host} 
          onChange={handleInputChange} 
          title="SSH Host (e.g., localhost)"
        />
        <input 
          type="number" 
          name="port" 
          placeholder="Port (required)" 
          value={serverInfo.port} 
          onChange={handleInputChange}
          min="1"
          max="65535"
          required
          style={{
            fontFamily: 'Courier New, monospace',
            fontWeight: 'bold'
          }}
          title="SSH Port from container (check Active Containers panel)"
        />
        <input 
          type="text" 
          name="username" 
          placeholder="Username" 
          value={serverInfo.username} 
          onChange={handleInputChange}
          title="SSH Username (e.g., root)" 
        />
        <label title="Use SSH Key Authentication instead of password">
          <input 
            type="checkbox" 
            name="useKeyAuth" 
            checked={serverInfo.useKeyAuth} 
            onChange={handleInputChange} 
          /> Use SSH Key
        </label>
        {!serverInfo.useKeyAuth ? (
          <input 
            type="password" 
            name="password" 
            placeholder="Password" 
            value={serverInfo.password} 
            onChange={handleInputChange}
            title="SSH Password" 
          />
        ) : (
          <>
            <textarea 
              name="privateKey" 
              placeholder="Private Key" 
              value={serverInfo.privateKey} 
              onChange={handleInputChange}
              rows={2}
              title="SSH Private Key (RSA, DSA, ECDSA, or Ed25519)"
            ></textarea>
            <input 
              type="password" 
              name="passphrase" 
              placeholder="Passphrase (if required)" 
              value={serverInfo.passphrase} 
              onChange={handleInputChange}
              title="Private Key Passphrase (leave empty if not required)" 
            />
          </>
        )}
        <button onClick={connectSSH} title="Connect to SSH server">Connect</button>
        <button onClick={disconnectSSH} title="Disconnect SSH session">Disconnect</button>
        <button onClick={downloadLog} title="Download session log">Download Log</button>
        <button onClick={clearTerminal} title="Clear terminal screen">Clear</button>
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