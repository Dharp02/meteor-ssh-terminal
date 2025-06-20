// imports/ui/components/ConnecctionForm.jsx
import React, { useState } from 'react';

const ConnectionForm = ({
  serverInfo,
  onInputChange,
  onConnect,
  onDisconnect,
  isConnected,
  connectionHistory,
  onLoadConnection,
  onClearHistory
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await onConnect();
    } finally {
      setTimeout(() => setIsConnecting(false), 2000); // Reset after 2 seconds
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // UPDATED: Enhanced validation function with port validation
  const validateForm = () => {
    const { host, username, password, privateKey, useKeyAuth, port } = serverInfo;
    
    if (!host.trim() || !username.trim()) {
      return false;
    }

    // Enhanced port validation
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

  const getConnectionStatus = () => {
    if (isConnecting) return 'Connecting...';
    if (isConnected) return 'Connected';
    return 'Disconnected';
  };

  const getStatusColor = () => {
    if (isConnecting) return '#f39c12';
    if (isConnected) return '#2ecc71';
    return '#e74c3c';
  };

  // UPDATED: Port validation helper
  const getPortValidationMessage = () => {
    if (!serverInfo.port || serverInfo.port.toString().trim() === '') {
      return 'Port is required';
    }
    
    const portNum = parseInt(serverInfo.port);
    if (isNaN(portNum)) {
      return 'Port must be a number';
    }
    
    if (portNum < 1 || portNum > 65535) {
      return 'Port must be between 1 and 65535';
    }
    
    return null;
  };

  return (
    <div className="connection-form-container">
      {/* Status Header */}
      <div className="connection-status-header">
        <div className="status-indicator-group">
          <div 
            className="status-dot"
            style={{ backgroundColor: getStatusColor() }}
          ></div>
          <span className="status-text">{getConnectionStatus()}</span>
        </div>
        
        {connectionHistory.length > 0 && (
          <div className="history-controls">
            <button 
              className="history-toggle-btn"
              onClick={() => setShowHistory(!showHistory)}
              title="Connection History"
            >
              📋 {showHistory ? 'Hide' : 'Show'} History
            </button>
          </div>
        )}
      </div>

      {/* Connection History */}
      {showHistory && connectionHistory.length > 0 && (
        <div className="connection-history">
          <div className="history-header">
            <h4>Recent Connections</h4>
            <button 
              className="clear-history-btn"
              onClick={onClearHistory}
              title="Clear all history"
            >
              🗑️ Clear
            </button>
          </div>
          
          <div className="history-list">
            {connectionHistory.map((conn, index) => (
              <div 
                key={index} 
                className="history-item"
                onClick={() => onLoadConnection(conn)}
                title="Click to load connection"
              >
                <div className="history-main">
                  <div className="history-connection">
                    <span className="history-host">{conn.host}:{conn.port}</span>
                    <span className="history-username">@{conn.username}</span>
                  </div>
                  {conn.useKeyAuth && (
                    <span className="auth-badge">🔑 Key Auth</span>
                  )}
                </div>
                <div className="history-time">
                  {formatDate(conn.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Connection Form */}
      <div className="connection-form">
        <div className="form-section">
          <h3>SSH Connection</h3>
          
          {/* Basic Connection Info */}
          <div className="form-row">
            <div className="input-group">
              <label htmlFor="host">Host *</label>
              <input
                id="host"
                type="text"
                name="host"
                value={serverInfo.host}
                onChange={onInputChange}
                placeholder="IP address or hostname"
                disabled={isConnected}
                required
              />
            </div>
            
            {/* UPDATED: Enhanced port input with validation */}
            <div className="input-group port-group">
              <label htmlFor="port">Port *</label>
              <input
                id="port"
                type="number"
                name="port"
                value={serverInfo.port}
                onChange={onInputChange}
                placeholder="Container port (required)"
                min="1"
                max="65535"
                disabled={isConnected}
                required
                style={{
                  fontFamily: 'Courier New, monospace',
                  fontWeight: 'bold',
                  borderColor: getPortValidationMessage() ? '#e74c3c' : '#ddd'
                }}
              />
              {getPortValidationMessage() && (
                <small className="input-error" style={{ color: '#e74c3c' }}>
                  {getPortValidationMessage()}
                </small>
              )}
              <small className="input-hint">
                Enter the SSH port for your container (check Active Containers panel)
              </small>
            </div>
          </div>

          <div className="form-row">
            <div className="input-group">
              <label htmlFor="username">Username *</label>
              <input
                id="username"
                type="text"
                name="username"
                value={serverInfo.username}
                onChange={onInputChange}
                placeholder="SSH username"
                disabled={isConnected}
                required
              />
            </div>
          </div>

          {/* Authentication Method Toggle */}
          <div className="auth-method-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={serverInfo.useKeyAuth}
                onChange={(e) => onInputChange({
                  target: {
                    name: 'useKeyAuth',
                    type: 'checkbox',
                    checked: e.target.checked
                  }
                })}
                disabled={isConnected}
              />
              <span className="toggle-switch"></span>
              Use SSH Key Authentication
            </label>
          </div>

          {/* Authentication Fields */}
          {serverInfo.useKeyAuth ? (
            <div className="auth-section key-auth">
              <div className="form-row">
                <div className="input-group">
                  <label htmlFor="privateKey">Private Key *</label>
                  <textarea
                    id="privateKey"
                    name="privateKey"
                    value={serverInfo.privateKey}
                    onChange={onInputChange}
                    placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                    rows={6}
                    disabled={isConnected}
                    required
                  />
                  <small className="input-hint">
                    Paste your private key here (RSA, DSA, ECDSA, or Ed25519)
                  </small>
                </div>
              </div>
              
              <div className="form-row">
                <div className="input-group">
                  <label htmlFor="passphrase">Passphrase</label>
                  <input
                    id="passphrase"
                    type="password"
                    name="passphrase"
                    value={serverInfo.passphrase}
                    onChange={onInputChange}
                    placeholder="Enter passphrase (if required)"
                    disabled={isConnected}
                  />
                  <small className="input-hint">
                    Leave empty if your private key has no passphrase
                  </small>
                </div>
              </div>
            </div>
          ) : (
            <div className="auth-section password-auth">
              <div className="form-row">
                <div className="input-group">
                  <label htmlFor="password">Password *</label>
                  <input
                    id="password"
                    type="password"
                    name="password"
                    value={serverInfo.password}
                    onChange={onInputChange}
                    placeholder="SSH password"
                    disabled={isConnected}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Advanced Options */}
          <div className="advanced-section">
            <button
              type="button"
              className="advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              ⚙️ Advanced Options {showAdvanced ? '▼' : '▶'}
            </button>
            
            {showAdvanced && (
              <div className="advanced-options">
                <div className="form-row">
                  <div className="input-group">
                    <label htmlFor="keepAlive">Keep Alive Interval (seconds)</label>
                    <input
                      id="keepAlive"
                      type="number"
                      name="keepAlive"
                      value={serverInfo.keepAlive || 30}
                      onChange={onInputChange}
                      min="10"
                      max="300"
                      disabled={isConnected}
                    />
                  </div>
                  
                  <div className="input-group">
                    <label htmlFor="timeout">Connection Timeout (seconds)</label>
                    <input
                      id="timeout"
                      type="number"
                      name="timeout"
                      value={serverInfo.timeout || 30}
                      onChange={onInputChange}
                      min="5"
                      max="120"
                      disabled={isConnected}
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        name="compression"
                        checked={serverInfo.compression || false}
                        onChange={onInputChange}
                        disabled={isConnected}
                      />
                      Enable compression
                    </label>
                  </div>
                  
                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        name="x11Forwarding"
                        checked={serverInfo.x11Forwarding || false}
                        onChange={onInputChange}
                        disabled={isConnected}
                      />
                      Enable X11 forwarding
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Connection Buttons */}
          <div className="connection-actions">
            {isConnected ? (
              <button
                type="button"
                className="disconnect-btn"
                onClick={onDisconnect}
              >
                🔌 Disconnect
              </button>
            ) : (
              <button
                type="button"
                className="connect-btn"
                onClick={handleConnect}
                disabled={!validateForm() || isConnecting}
                title={!validateForm() ? 'Please fill in all required fields with valid values' : 'Connect to SSH server'}
              >
                {isConnecting ? (
                  <>
                    <span className="spinner"></span>
                    Connecting...
                  </>
                ) : (
                  <>
                    🚀 Connect
                  </>
                )}
              </button>
            )}
            
            {!isConnected && (
              <button
                type="button"
                className="test-connection-btn"
                onClick={() => {
                  console.log('Test connection feature - to be implemented');
                }}
                disabled={!validateForm() || isConnecting}
              >
                🔍 Test Connection
              </button>
            )}
          </div>

          {/* UPDATED: Enhanced connection tips */}
          <div className="connection-tips">
            <h4>💡 Connection Tips</h4>
            <ul>
              <li><strong>Port Required:</strong> You must enter the container's SSH port number</li>
              <li><strong>Find Ports:</strong> Check the "Active Containers" panel for port numbers</li>
              <li><strong>SSH Keys:</strong> Use SSH keys for better security instead of passwords</li>
              <li><strong>Container Ports:</strong> Each container has a unique mapped port</li>
              <li><strong>Sessions:</strong> Automatically expire after 30 minutes of inactivity</li>
              <li><strong>Copy/Paste:</strong> Use Ctrl+Shift+C/V for copy/paste in the terminal</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionForm;