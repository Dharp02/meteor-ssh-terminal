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
  
  const [terminals, setTerminals] = useState([{ id: 1, title: 'Terminal 1' }]);
  const [activeTab, setActiveTab] = useState(1);
  
  const [serverInfo, setServerInfo] = useState({
    host: 'localhost',
    port: 22,
    username: 'root',
    password: '',
    useKeyAuth: false,
    privateKey: '',
    passphrase: ''
  });
  
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [logData, setLogData] = useState('');

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
    term.current.writeln('New Terminal Instance');
    term.current.writeln('\x1b[32mConnected to WebSocket server\x1b[0m');

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
        setLogData(prev => prev + data);
      }
    });

    socket.current.on('sshConnected', () => {
      setConnectionStatus('SSH Connected');
      setIsConnected(true);
      setIsConnecting(false);
      term.current.writeln('\r\n\x1b[32mSSH Connection established\x1b[0m');
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
        setLogData(prev => prev + data);
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
      setLogData('');
    }
  };

  const downloadLog = () => {
    const blob = new Blob([logData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vm-session-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createNewTerminalTab = () => {
    const id = Date.now();
    const newTab = {
      id,
      title: `Terminal ${terminals.length + 1}`
    };
    setTerminals(prev => [...prev, newTab]);
    setActiveTab(id);
  };

  const closeTab = (id) => {
    if (terminals.length <= 1) return; // Don't close last tab
    
    setTerminals(prev => {
      const newTerminals = prev.filter(tab => tab.id !== id);
      return newTerminals;
    });
    
    if (activeTab === id) {
      const remainingTerminals = terminals.filter(tab => tab.id !== id);
      if (remainingTerminals.length > 0) {
        const fallback = remainingTerminals[remainingTerminals.length - 1];
        setActiveTab(fallback.id);
      }
    }
  };

  return (
    <div className="vm-terminal-container">
      {/* Back to Services Button */}
      <div className="back-to-services-header">
        <button className="back-to-services-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Services
        </button>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar">
        {terminals.map(tab => (
          <div
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span title={tab.title}>
              {tab.title}
            </span>
            {terminals.length > 1 && (
              <button 
                className="close-btn" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  closeTab(tab.id); 
                }}
                title="Close tab"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button 
          className="add-tab" 
          onClick={createNewTerminalTab}
          title="Add new terminal"
        >
          +
        </button>
      </div>

      {/* Terminal Header with Connection Form */}
      <div className="terminal-header">
        <input 
          type="text" 
          name="host" 
          placeholder="Host" 
          value={serverInfo.host} 
          onChange={handleInputChange}
          disabled={isConnected}
        />
        <input 
          type="number" 
          name="port" 
          placeholder="Port" 
          value={serverInfo.port} 
          onChange={handleInputChange}
          disabled={isConnected}
          min="1"
          max="65535"
        />
        <input 
          type="text" 
          name="username" 
          placeholder="Username" 
          value={serverInfo.username} 
          onChange={handleInputChange}
          disabled={isConnected}
        />
        <label>
          <input 
            type="checkbox" 
            name="useKeyAuth" 
            checked={serverInfo.useKeyAuth} 
            onChange={handleInputChange}
            disabled={isConnected}
          /> 
          SSH Key
        </label>
        {!serverInfo.useKeyAuth ? (
          <input 
            type="password" 
            name="password" 
            placeholder="Password" 
            value={serverInfo.password} 
            onChange={handleInputChange}
            disabled={isConnected}
          />
        ) : (
          <>
            <textarea 
              name="privateKey" 
              placeholder="Private Key" 
              value={serverInfo.privateKey} 
              onChange={handleInputChange}
              disabled={isConnected}
              style={{ display: 'none' }}
            />
            <input 
              type="password" 
              name="passphrase" 
              placeholder="Passphrase" 
              value={serverInfo.passphrase} 
              onChange={handleInputChange}
              disabled={isConnected}
            />
          </>
        )}
        {isConnected ? (
          <>
            <button onClick={disconnectSSH} className="disconnect-button">
              Disconnect
            </button>
            <button onClick={downloadLog} className="history-button">
              Download Log
            </button>
            <button onClick={clearTerminal} className="clear-history-button">
              Clear
            </button>
          </>
        ) : (
          <button 
            onClick={connectSSH} 
            disabled={!validateForm() || isConnecting}
            className="connect-button"
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>

      {/* Terminal Instance */}
      <div
        className="terminal-instance"
        ref={terminalRef}
      />
    </div>
  );
};

export default VMTerminal;