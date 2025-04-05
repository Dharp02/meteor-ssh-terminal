import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import io from 'socket.io-client';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'xterm/css/xterm.css';
import TerminalHeader from '../imports/ui/components/TerminalHeader';

const TerminalComponent = () => {
  const terminalRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [terminalInstance, setTerminalInstance] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');

  // Default empty values for connection info
  const [serverInfo, setServerInfo] = useState({
    host: "",
    port: 22,
    username: "",
    password: "",
    useKeyAuth: false,
    privateKey: "",
    passphrase: ""
  });

  // Store connection history
  const [connectionHistory, setConnectionHistory] = useState([]);

  // Load connection history from localStorage
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('ssh-connection-history');
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        setConnectionHistory(parsedHistory);
        if (parsedHistory.length > 0) {
          const mostRecent = parsedHistory[0];
          setServerInfo({
            host: mostRecent.host || "",
            port: mostRecent.port || 22,
            username: mostRecent.username || "",
            password: "", // Do not load sensitive data
            useKeyAuth: mostRecent.useKeyAuth || false,
            privateKey: "",
            passphrase: ""
          });
        }
      }
    } catch (e) {
      console.error("Error loading connection history", e);
    }
  }, []);

  // Save connection history to localStorage
  const saveHistoryToLocalStorage = (history) => {
    try {
      const sanitizedHistory = history.map(item => ({
        host: item.host,
        port: item.port,
        username: item.username,
        useKeyAuth: item.useKeyAuth,
        timestamp: item.timestamp
      }));
      localStorage.setItem('ssh-connection-history', JSON.stringify(sanitizedHistory));
    } catch (e) {
      console.error("Error saving connection history", e);
    }
  };

  // Clear connection history
  const clearConnectionHistory = () => {
    setConnectionHistory([]);
    localStorage.removeItem('ssh-connection-history');
    toast.info('Connection history cleared');
  };

  // Initialize terminal and socket connection
  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#f0f0f0',
        cursor: '#f0f0f0',
        selectionBackground: '#5DA5D533'
      },
      scrollback: 5000,
      macOptionIsMeta: true,
      rightClickSelectsWord: false,
      disableStdin: false,
      fastScrollModifier: 'alt',
      fastScrollSensitivity: 5,
      windowsMode: navigator.platform.toLowerCase().includes('win'),
      convertEol: true
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    // Custom key handling for shortcuts and preventing default browser behavior
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;

      if (event.ctrlKey && event.key === 'f') {
        const searchTerm = prompt('Search for:');
        if (searchTerm) searchAddon.findNext(searchTerm);
        return false;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        return true;
      }

      if (event.ctrlKey && event.key === 'c') {
        const selection = term.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          toast.info('Copied to clipboard!', { autoClose: 2000 });
          return false;
        } else if (connectionStatus === 'SSH Connected') {
          socket?.emit('input', '\x03');
          return false;
        }
      }
      return true;
    });

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch (e) {
        console.error('Error resizing terminal:', e);
      }
    };
    window.addEventListener('resize', handleResize);

    setTerminalInstance(term);
    const socketInstance = io(window.location.origin);
    setSocket(socketInstance);

    // Welcome messages and instructions
    term.writeln('\x1b[1;34m  ____  ____  _   _   _____                  _             _ \x1b[0m');
    term.writeln('\x1b[1;34m / ___||  _ \\| | | | |_   _|__ _ __ _ __ ___ (_)_ __   __ _| |\x1b[0m');
    term.writeln('\x1b[1;34m \\___ \\| |_) | |_| |   | |/ _ \\ \'__| \'_ ` _ \\| | \'_ \\ / _` | |\x1b[0m');
    term.writeln('\x1b[1;34m  ___) |  __/|  _  |   | |  __/ |  | | | | | | | | | | (_| | |\x1b[0m');
    term.writeln('\x1b[1;34m |____/|_|   |_| |_|   |_|\\___|_|  |_| |_| |_|_|_| |_|\\__,_|_|\x1b[0m');
    term.writeln('\x1b[32mWelcome to SSH Terminal. Connect to a server using the form above.\x1b[0m\r\n');
    term.writeln('\x1b[33mKeyboard shortcuts:\x1b[0m');
    term.writeln('  • \x1b[36mCtrl+F\x1b[0m: Search terminal buffer');
    term.writeln('  • \x1b[36mCtrl+C\x1b[0m: Copy selected text or send SIGINT');
    term.writeln('  • \x1b[36mCtrl+Insert\x1b[0m: Copy');
    term.writeln('  • \x1b[36mShift+Insert\x1b[0m: Paste\r\n');

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      socketInstance.disconnect();
    };
  }, []);

  // Set up socket events and terminal onData listener with command buffering
  useEffect(() => {
    if (!socket || !terminalInstance) return;

    socket.on('connect', () => {
      setIsConnected(true);
      setConnectionStatus('Connected to server');
      toast.success('Connected to WebSocket server');
      terminalInstance.writeln('\r\n\x1b[32mConnected to WebSocket server\x1b[0m');
    });
    socket.on('disconnect', () => {
      setIsConnected(false);
      setConnectionStatus('Disconnected');
      toast.error('Disconnected from server');
      terminalInstance.writeln('\r\n\x1b[31mDisconnected from WebSocket server\x1b[0m');
    });
    socket.on('sshConnected', () => {
      setConnectionStatus('SSH Connected');
      toast.success('SSH Connection established');
      terminalInstance.writeln('\r\n\x1b[32mSSH Connection established\x1b[0m');

      const { host, port, username, useKeyAuth } = serverInfo;
      const connectionDetails = { host, port, username, useKeyAuth, timestamp: new Date() };
      setConnectionHistory(prevHistory => {
        const filteredHistory = prevHistory.filter(item => !(item.host === host && item.username === username));
        const newHistory = [connectionDetails, ...filteredHistory].slice(0, 10);
        saveHistoryToLocalStorage(newHistory);
        return newHistory;
      });
    });
    socket.on('output', (data) => {
      terminalInstance.write(data);
    });

    let commandBuffer = '';
    const handleData = (data) => {
      if (isConnected && connectionStatus === 'SSH Connected') {
        if (data === '\r' || data === '\n') {
          if (commandBuffer.trim()) {
            console.log('User typed command:', commandBuffer);
          }
          commandBuffer = '';
        } else {
          commandBuffer += data;
        }
        socket.emit('input', data);
      }
    };

    const disposable = terminalInstance.onData(handleData);

    return () => {
      disposable.dispose();
      socket.off('connect');
      socket.off('disconnect');
      socket.off('sshConnected');
      socket.off('output');
    };
  }, [socket, terminalInstance, isConnected, connectionStatus, serverInfo]);

  // Connect to SSH session
  const connectSSH = () => {
    if (!socket || !isConnected) return;
    if (!serverInfo.host || !serverInfo.username) {
      toast.error('Host and username are required');
      return;
    }
    const port = parseInt(serverInfo.port, 10) || 22;
    terminalInstance.clear();
    terminalInstance.writeln(`\r\n\x1b[33mConnecting to ${serverInfo.host}:${port} as ${serverInfo.username}...\x1b[0m`);
    socket.emit('startSession', {
      host: serverInfo.host,
      port: port,
      username: serverInfo.username,
      useKeyAuth: serverInfo.useKeyAuth,
      password: !serverInfo.useKeyAuth ? serverInfo.password : undefined,
      privateKey: serverInfo.useKeyAuth ? serverInfo.privateKey : undefined,
      passphrase: serverInfo.useKeyAuth ? serverInfo.passphrase : undefined
    });
    setServerInfo(prev => ({
      ...prev,
      password: '',
      privateKey: '',
      passphrase: '',
      port: port
    }));
  };

  // Disconnect from SSH session
  const disconnectSSH = () => {
    if (socket && connectionStatus === 'SSH Connected') {
      socket.emit('endSession');
      setConnectionStatus('Connected to server');
      terminalInstance.writeln('\r\n\x1b[33mDisconnecting from SSH session...\x1b[0m');
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setServerInfo(prev => ({ ...prev, [name]: value }));
  };

  // Load a saved connection from history
  const loadSavedConnection = (connection) => {
    setServerInfo({
      ...serverInfo,
      host: connection.host,
      port: connection.port || 22,
      username: connection.username,
      useKeyAuth: connection.useKeyAuth || false,
      password: "",
      privateKey: "",
      passphrase: ""
    });
    toast.info(`Loaded connection to ${connection.host}`);
  };

  return (
    <div className="terminal-page">
      <ToastContainer position="top-right" autoClose={3000} />
      <TerminalHeader
        connectionStatus={connectionStatus}
        serverInfo={serverInfo}
        handleInputChange={handleInputChange}
        connectSSH={connectSSH}
        disconnectSSH={disconnectSSH}
        isConnected={isConnected}
        connectionHistory={connectionHistory}
        loadSavedConnection={loadSavedConnection}
        clearConnectionHistory={clearConnectionHistory}
      />
      <div className="terminal-container" ref={terminalRef}></div>
    </div>
  );
};

export default TerminalComponent;
