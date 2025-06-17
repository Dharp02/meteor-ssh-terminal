// imports/ui/components/EnhancedTerminalInstance.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from 'xterm-addon-web-links';
import io from 'socket.io-client';
import { Meteor } from 'meteor/meteor';
import 'xterm/css/xterm.css';

const THEMES = {
  dark: {
    background: '#1e1e1e',
    foreground: '#ffffff',
    cursor: '#ffffff',
    selection: '#4d4d4d',
    black: '#000000',
    red: '#e74c3c',
    green: '#2ecc71',
    yellow: '#f1c40f',
    blue: '#3498db',
    magenta: '#9b59b6',
    cyan: '#1abc9c',
    white: '#ecf0f1'
  },
  light: {
    background: '#ffffff',
    foreground: '#2c3e50',
    cursor: '#2c3e50',
    selection: '#d5dbdb',
    black: '#2c3e50',
    red: '#e74c3c',
    green: '#27ae60',
    yellow: '#f39c12',
    blue: '#2980b9',
    magenta: '#8e44ad',
    cyan: '#16a085',
    white: '#ecf0f1'
  },
  monokai: {
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f0',
    selection: '#49483e',
    black: '#272822',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2'
  },
  solarized: {
    background: '#002b36',
    foreground: '#839496',
    cursor: '#93a1a1',
    selection: '#073642',
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5'
  }
};

const DEFAULT_SETTINGS = {
  fontSize: 14,
  fontFamily: 'Monaco, Menlo, "DejaVu Sans Mono", "Lucida Console", monospace',
  theme: 'dark',
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 5000,
  bellSound: false,
  allowTransparency: false,
  fontWeight: 'normal',
  fontWeightBold: 'bold',
  lineHeight: 1.2
};

const EnhancedTerminalInstance = ({ tabId, onStatusChange, onTitleChange }) => {
  const terminalRef = useRef(null);
  const term = useRef(null);
  const fitAddon = useRef(new FitAddon());
  const searchAddon = useRef(new SearchAddon());
  const webLinksAddon = useRef(new WebLinksAddon());
  const socket = useRef(null);
  const resizeObserver = useRef(null);

  // State
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [remainingTime, setRemainingTime] = useState(null);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem(`terminal-settings-${tabId}`);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [connectionHistory, setConnectionHistory] = useState(() => {
    const saved = localStorage.getItem('ssh-connection-history');
    return saved ? JSON.parse(saved) : [];
  });

  const [serverInfo, setServerInfo] = useState({
    host: 'localhost',
    port: 22,
    username: 'root',
    password: '',
    useKeyAuth: false,
    privateKey: '',
    passphrase: ''
  });

  // Save settings when they change
  useEffect(() => {
    localStorage.setItem(`terminal-settings-${tabId}`, JSON.stringify(settings));
  }, [settings, tabId]);

  // Initialize terminal
  useEffect(() => {
    initializeTerminal();
    setupSocketConnection();
    
    return () => {
      cleanup();
    };
  }, [tabId]);

  // Apply settings when they change
  useEffect(() => {
    if (term.current) {
      applySettings();
    }
  }, [settings]);

  const initializeTerminal = useCallback(() => {
    if (term.current) {
      term.current.dispose();
    }

    term.current = new Terminal({
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      cursorStyle: settings.cursorStyle,
      cursorBlink: settings.cursorBlink,
      scrollback: settings.scrollback,
      bellSound: settings.bellSound,
      allowTransparency: settings.allowTransparency,
      fontWeight: settings.fontWeight,
      fontWeightBold: settings.fontWeightBold,
      lineHeight: settings.lineHeight,
      theme: THEMES[settings.theme],
      rightClickSelectsWord: true,
      macOptionIsMeta: true
    });

    // Load addons
    term.current.loadAddon(fitAddon.current);
    term.current.loadAddon(searchAddon.current);
    term.current.loadAddon(webLinksAddon.current);

    // Open terminal
    term.current.open(terminalRef.current);
    fitAddon.current.fit();

    // Setup resize observer
    if (resizeObserver.current) {
      resizeObserver.current.disconnect();
    }
    
    resizeObserver.current = new ResizeObserver(() => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    });
    
    resizeObserver.current.observe(terminalRef.current);

    // Terminal event handlers
    term.current.onData(data => {
      if (socket.current && isConnected) {
        socket.current.emit('input', data);
      }
    });

    term.current.onTitleChange(title => {
      if (onTitleChange && title.trim()) {
        onTitleChange(title.trim());
      }
    });

    // Keyboard shortcuts
    term.current.attachCustomKeyEventHandler((event) => {
      // Ctrl+Shift+F for search
      if (event.ctrlKey && event.shiftKey && event.key === 'F') {
        setSearchVisible(true);
        return false;
      }
      
      // Ctrl+Shift+C for copy
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        const selection = term.current.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
        }
        return false;
      }
      
      // Ctrl+Shift+V for paste
      if (event.ctrlKey && event.shiftKey && event.key === 'V') {
        navigator.clipboard.readText().then(text => {
          if (text && socket.current && isConnected) {
            socket.current.emit('input', text);
          }
        });
        return false;
      }
      
      return true;
    });

    // Welcome message
    term.current.writeln(`\x1b[36m╭─────────────────────────────────────╮\x1b[0m`);
    term.current.writeln(`\x1b[36m│        Enhanced SSH Terminal        │\x1b[0m`);
    term.current.writeln(`\x1b[36m╰─────────────────────────────────────╯\x1b[0m`);
    term.current.writeln(`\x1b[33mTab ID: ${tabId}\x1b[0m`);
    term.current.writeln(`\x1b[32mReady to connect...\x1b[0m\r\n`);

    term.current.focus();
  }, [settings, tabId, isConnected, onTitleChange]);

  const setupSocketConnection = useCallback(() => {
    if (socket.current) {
      socket.current.disconnect();
    }

    socket.current = io(window.location.origin, {
      forceNew: true,
      transports: ['websocket', 'polling']
    });

    socket.current.on('connect', () => {
      setConnectionStatus('Connected to Server');
      setIsConnected(true);
      onStatusChange?.('connected');
      
      if (term.current) {
        term.current.writeln('\r\n\x1b[32m✓ Connected to WebSocket server\x1b[0m');
      }
    });

    socket.current.on('disconnect', () => {
      setConnectionStatus('Disconnected');
      setIsConnected(false);
      setRemainingTime(null);
      onStatusChange?.('disconnected');
      
      if (term.current) {
        term.current.writeln('\r\n\x1b[31m✗ Disconnected from server\x1b[0m');
      }
    });

    socket.current.on('output', data => {
      if (term.current) {
        term.current.write(data);
      }
    });

    socket.current.on('sshConnected', (data) => {
      setConnectionStatus('SSH Connected');
      onStatusChange?.('ssh-connected');
      
      if (data.remainingTime) {
        setRemainingTime(Math.floor(data.remainingTime / 1000));
      }
      
      if (term.current) {
        term.current.writeln('\r\n\x1b[32m✓ SSH Connection established\x1b[0m');
        term.current.writeln(`\x1b[33mSession will expire in ${Math.floor((data.remainingTime || 600000) / 60000)} minutes\x1b[0m\r\n`);
      }
    });

    socket.current.on('error', (error) => {
      console.error('Socket error:', error);
      if (term.current) {
        term.current.writeln(`\r\n\x1b[31mConnection error: ${error.message}\x1b[0m\r\n`);
      }
    });
  }, [onStatusChange]);

  const applySettings = useCallback(() => {
    if (!term.current) return;

    // Update terminal options
    term.current.options.fontSize = settings.fontSize;
    term.current.options.fontFamily = settings.fontFamily;
    term.current.options.cursorStyle = settings.cursorStyle;
    term.current.options.cursorBlink = settings.cursorBlink;
    term.current.options.theme = THEMES[settings.theme];
    term.current.options.fontWeight = settings.fontWeight;
    term.current.options.fontWeightBold = settings.fontWeightBold;
    term.current.options.lineHeight = settings.lineHeight;

    // Refresh terminal
    term.current.refresh(0, term.current.rows - 1);
    
    // Refit terminal
    setTimeout(() => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    }, 100);
  }, [settings]);

  // Countdown timer
  useEffect(() => {
    if (remainingTime === null || remainingTime <= 0) return;
    
    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev > 0) return prev - 1;
        clearInterval(timer);
        return 0;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [remainingTime]);

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setServerInfo(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  }, []);

  const connectSSH = useCallback(() => {
    if (!socket.current || !isConnected) {
      if (term.current) {
        term.current.writeln('\r\n\x1b[31m✗ Not connected to server\x1b[0m\r\n');
      }
      return;
    }

    const port = parseInt(serverInfo.port) || 22;
    
    if (term.current) {
      term.current.writeln(`\r\n\x1b[33m→ Connecting to ${serverInfo.host}:${port} as ${serverInfo.username}...\x1b[0m`);
    }

    // Save connection to history
    const connectionData = {
      ...serverInfo,
      timestamp: new Date().toISOString()
    };
    
    const newHistory = [connectionData, ...connectionHistory.filter(
      conn => !(conn.host === serverInfo.host && 
                conn.port === serverInfo.port && 
                conn.username === serverInfo.username)
    )].slice(0, 10); // Keep only 10 recent connections
    
    setConnectionHistory(newHistory);
    localStorage.setItem('ssh-connection-history', JSON.stringify(newHistory));

    // Emit connection request
    socket.current.emit('startSession', {
      host: serverInfo.host,
      port,
      username: serverInfo.username,
      useKeyAuth: serverInfo.useKeyAuth,
      password: !serverInfo.useKeyAuth ? serverInfo.password : undefined,
      privateKey: serverInfo.useKeyAuth ? serverInfo.privateKey : undefined,
      passphrase: serverInfo.useKeyAuth ? serverInfo.passphrase : undefined,
      tabId: tabId,
      userAgent: navigator.userAgent,
      userId: Meteor.userId() || `anonymous-${Date.now()}`
    });
  }, [socket, isConnected, serverInfo, connectionHistory, tabId]);

  const disconnectSSH = useCallback(() => {
    if (socket.current) {
      socket.current.emit('endSession');
      setConnectionStatus('Disconnected');
      setRemainingTime(null);
      onStatusChange?.('disconnected');
      
      if (term.current) {
        term.current.writeln('\r\n\x1b[33m✗ SSH session terminated by user\x1b[0m\r\n');
      }
    }
  }, [onStatusChange]);

  const clearTerminal = useCallback(() => {
    if (term.current) {
      term.current.clear();
    }
  }, []);

  const loadSavedConnection = useCallback((conn) => {
    setServerInfo({
      host: conn.host,
      port: conn.port,
      username: conn.username,
      useKeyAuth: conn.useKeyAuth || false,
      password: '',
      privateKey: '',
      passphrase: ''
    });
  }, []);

  const clearConnectionHistory = useCallback(() => {
    setConnectionHistory([]);
    localStorage.removeItem('ssh-connection-history');
  }, []);

  const handleSearch = useCallback((searchTerm, direction = 'next') => {
    if (!searchAddon.current || !searchTerm) return;

    if (direction === 'next') {
      searchAddon.current.findNext(searchTerm);
    } else {
      searchAddon.current.findPrevious(searchTerm);
    }
  }, []);

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const exportSettings = useCallback(() => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `terminal-settings-${tabId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [settings, tabId]);

  const importSettings = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target.result);
        setSettings({ ...DEFAULT_SETTINGS, ...importedSettings });
        if (term.current) {
          term.current.writeln('\r\n\x1b[32m✓ Settings imported successfully\x1b[0m\r\n');
        }
      } catch (error) {
        console.error('Failed to import settings:', error);
        if (term.current) {
          term.current.writeln('\r\n\x1b[31m✗ Failed to import settings\x1b[0m\r\n');
        }
      }
    };
    reader.readAsText(file);
  }, []);

  const cleanup = useCallback(() => {
    if (socket.current) {
      socket.current.emit('endSession');
      socket.current.disconnect();
    }
    
    if (term.current) {
      term.current.dispose();
    }
    
    if (resizeObserver.current) {
      resizeObserver.current.disconnect();
    }
  }, []);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return (
    <div className="enhanced-terminal-container">
      {/* Terminal Header with Controls */}
      <div className="terminal-header">
        <div className="status-section">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span className="status-text">{connectionStatus}</span>
          {remainingTime !== null && remainingTime > 0 && (
            <span className="session-timer">
               {formatTime(remainingTime)}
            </span>
          )}
        </div>
        
        <div className="control-buttons">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="control-btn"
            title="Terminal Settings"
          >
            
          </button>
          <button 
            onClick={() => setSearchVisible(!searchVisible)}
            className="control-btn"
            title="Search (Ctrl+Shift+F)"
          >
            
          </button>
          <button 
            onClick={clearTerminal}
            className="control-btn"
            title="Clear Terminal"
          >
            
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {searchVisible && (
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search in terminal..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(e.target.value, e.shiftKey ? 'previous' : 'next');
              } else if (e.key === 'Escape') {
                setSearchVisible(false);
              }
            }}
            autoFocus
          />
          <button onClick={() => setSearchVisible(false)}>✕</button>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <TerminalSettings
          settings={settings}
          onUpdate={updateSetting}
          onReset={resetSettings}
          onExport={exportSettings}
          onImport={importSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Connection Form */}
      <ConnectionForm
        serverInfo={serverInfo}
        onInputChange={handleInputChange}
        onConnect={connectSSH}
        onDisconnect={disconnectSSH}
        isConnected={connectionStatus === 'SSH Connected'}
        connectionHistory={connectionHistory}
        onLoadConnection={loadSavedConnection}
        onClearHistory={clearConnectionHistory}
      />

      {/* Terminal Container */}
      <div 
        className="terminal-instance"
        ref={terminalRef}
        style={{ 
          height: '500px', 
          width: '100%',
          backgroundColor: THEMES[settings.theme].background
        }}
      />
    </div>
  );
};

export default EnhancedTerminalInstance;