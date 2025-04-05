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
  const keyPressTimeoutRef = useRef(null);
  const lastKeyTimeRef = useRef(0);
  const KEY_DEBOUNCE_TIME = 15; // milliseconds to prevent duplicate keys
  
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
  
  // Initialize from localStorage if available
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('ssh-connection-history');
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        setConnectionHistory(parsedHistory);
        
        // Set the most recent connection as default (if exists)
        if (parsedHistory.length > 0) {
          const mostRecent = parsedHistory[0];
          setServerInfo({
            host: mostRecent.host || "",
            port: mostRecent.port || 22,
            username: mostRecent.username || "",
            password: "", // Never load saved passwords
            useKeyAuth: mostRecent.useKeyAuth || false,
            privateKey: "", // Never load saved private keys
            passphrase: "" // Never load saved passphrases
          });
        }
      }
    } catch (e) {
      console.error("Error loading connection history", e);
    }
  }, []);

  // Save history to localStorage
  const saveHistoryToLocalStorage = (history) => {
    try {
      // Make sure to strip any sensitive data before saving
      const sanitizedHistory = history.map(item => ({
        host: item.host,
        port: item.port,
        username: item.username,
        useKeyAuth: item.useKeyAuth,
        timestamp: item.timestamp
        // Never include password, privateKey, or passphrase
      }));
      localStorage.setItem('ssh-connection-history', JSON.stringify(sanitizedHistory));
    } catch (e) {
      console.error("Error saving connection history", e);
    }
  };

  // Clear all connection history
  const clearConnectionHistory = () => {
    setConnectionHistory([]);
    localStorage.removeItem('ssh-connection-history');
    toast.info('Connection history cleared');
  };

  // Initialize the terminal
  useEffect(() => {
    // Create terminal instance
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
      allowTransparency: true,
      scrollback: 5000,
      // Add these options for better keyboard handling:
      macOptionIsMeta: true,       // Better handling of option key on Mac
      macOptionClickForcesSelection: false,
      rightClickSelectsWord: false,
      disableStdin: false,         // Make sure input is enabled
      cursorBlink: true,           // Makes it easier to see where you're typing
      fastScrollModifier: 'alt',   // Allow fast scrolling with Alt key
      fastScrollSensitivity: 5,    // How many lines to scroll with fast scroll
      // These handle keyboard better:
      screenReaderMode: false,     // Can help with some keyboard issues
      windowsMode: navigator.platform.toLowerCase().includes('win'),  // Better handling for Windows
      convertEol: true,            // Ensure line endings are handled properly
    });

    // Create and load addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);

    // Open terminal in the container
    term.open(terminalRef.current);
    fitAddon.fit();

    // Add custom key handler for special keys
    term.attachCustomKeyEventHandler((event) => {
      // Skip events that aren't keydown to avoid duplicates
      if (event.type !== 'keydown') return true;

      // Ctrl+F to search
      if (event.ctrlKey && event.key === 'f') {
        // Here you could show a custom search UI
        const searchTerm = prompt('Search for:');
        if (searchTerm) {
          searchAddon.findNext(searchTerm);
        }
        return false;
      }
      
      // Handle common issues with specific keys
      if (event.key === 'Backspace') {
        // Some browsers have issues with backspace in terminals
        // Let Xterm handle it naturally
        return true;
      }

      // Fix issues with arrow keys in some browsers
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        // Prevent the browser from scrolling
        event.preventDefault();
        return true;
      }

      // Handle Ctrl+C to copy selected text or send SIGINT
      if (event.ctrlKey && event.key === 'c') {
        const selection = term.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          toast.info('Copied to clipboard!', { autoClose: 2000 });
          return false;
        } else if (connectionStatus === 'SSH Connected') {
          // No selection, so send SIGINT signal
          socket.emit('input', '\x03');
          return false;
        }
      }

      // Let other keys pass through to default handlers
      return true;
    });

    // Handle window resize events
    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch (e) {
        console.error('Error resizing terminal:', e);
      }
    };
    
    window.addEventListener('resize', handleResize);

    // Set terminal instance to state
    setTerminalInstance(term);

    // Initialize socket connection
    const socketInstance = io(window.location.origin);
    setSocket(socketInstance);

    // Display welcome message
    term.writeln('\x1b[1;34m  ____  ____  _   _   _____                  _             _ \x1b[0m');
    term.writeln('\x1b[1;34m / ___||  _ \\| | | | |_   _|__ _ __ _ __ ___ (_)_ __   __ _| |\x1b[0m');
    term.writeln('\x1b[1;34m \\___ \\| |_) | |_| |   | |/ _ \\ \'__| \'_ ` _ \\| | \'_ \\ / _` | |\x1b[0m');
    term.writeln('\x1b[1;34m  ___) |  __/|  _  |   | |  __/ |  | | | | | | | | | | (_| | |\x1b[0m');
    term.writeln('\x1b[1;34m |____/|_|   |_| |_|   |_|\\___|_|  |_| |_| |_|_|_| |_|\\__,_|_|\x1b[0m');
    term.writeln('\x1b[32mWelcome to SSH Terminal. Connect to a server using the form above.\x1b[0m\r\n');
    term.writeln('\x1b[33mKeyboard shortcuts:\x1b[0m');
    term.writeln('  • \x1b[36mCtrl+F\x1b[0m: Search terminal buffer');
    term.writeln('  • \x1b[36mCtrl+C\x1b[0m: Copy selected text');
    term.writeln('  • \x1b[36mCtrl+Insert\x1b[0m: Copy');
    term.writeln('  • \x1b[36mShift+Insert\x1b[0m: Paste\r\n');

    // Clean up on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      // Clear any pending key timeouts
      if (keyPressTimeoutRef.current) {
        clearTimeout(keyPressTimeoutRef.current);
      }
      term.dispose();
      socketInstance.disconnect();
    };
  }, []);

  // Set up socket event handlers
  useEffect(() => {
    if (!socket || !terminalInstance) return;

    // Handle socket connection events
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
      
      // Add to connection history (if not already there)
      const { host, port, username, useKeyAuth } = serverInfo;
      const connectionDetails = { 
        host, 
        port, 
        username, 
        useKeyAuth,
        timestamp: new Date() 
      };
      
      setConnectionHistory(prevHistory => {
        // Remove any existing entry with the same host/username
        const filteredHistory = prevHistory.filter(
          item => !(item.host === host && item.username === username)
        );
        
        // Add new connection at the beginning
        const newHistory = [connectionDetails, ...filteredHistory].slice(0, 10); // Keep last 10 connections
        
        // Save to localStorage (with sensitive data stripped)
        saveHistoryToLocalStorage(newHistory);
        
        return newHistory;
      });
    });

    socket.on('output', (data) => {
      terminalInstance.write(data);
    });

    // Improved terminal input handling with debouncing
    terminalInstance.onData(data => {
      if (isConnected && connectionStatus === 'SSH Connected') {
        const now = Date.now();
        
        // Check if this is a repeated keypress happening too quickly
        if (now - lastKeyTimeRef.current < KEY_DEBOUNCE_TIME) {
          // Clear any pending output and return without sending
          clearTimeout(keyPressTimeoutRef.current);
          return;
        }
        
        // Update last key time
        lastKeyTimeRef.current = now;
        
        // Small delay to prevent duplicates within the threshold
        keyPressTimeoutRef.current = setTimeout(() => {
          socket.emit('input', data);
        }, 5);
      }
    });

    // Clean up event listeners on component unmount or when socket changes
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('sshConnected');
      socket.off('output');
    };
  }, [socket, terminalInstance, isConnected, connectionStatus, serverInfo]);

  // Connect to SSH when button is clicked
  const connectSSH = () => {
    if (!socket || !isConnected) return;
    
    if (!serverInfo.host || !serverInfo.username) {
      toast.error('Host and username are required');
      return;
    }
    
    // Ensure port is a number
    const port = parseInt(serverInfo.port, 10) || 22;
    
    terminalInstance.clear();
    terminalInstance.writeln(`\r\n\x1b[33mConnecting to ${serverInfo.host}:${port} as ${serverInfo.username}...\x1b[0m`);
    
    // Send connection info to server
    socket.emit('startSession', {
      host: serverInfo.host,
      port: port,
      username: serverInfo.username,
      useKeyAuth: serverInfo.useKeyAuth,
      password: !serverInfo.useKeyAuth ? serverInfo.password : undefined,
      privateKey: serverInfo.useKeyAuth ? serverInfo.privateKey : undefined,
      passphrase: serverInfo.useKeyAuth ? serverInfo.passphrase : undefined
    });
    
    // Clear sensitive data from state after sending
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
    setServerInfo(prev => ({...prev, [name]: value}));
  };
  
  // Load a saved connection
  const loadSavedConnection = (connection) => {
    setServerInfo({
      ...serverInfo, // Keep existing state
      host: connection.host,
      port: connection.port || 22,
      username: connection.username,
      useKeyAuth: connection.useKeyAuth || false,
      // Never load credentials
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