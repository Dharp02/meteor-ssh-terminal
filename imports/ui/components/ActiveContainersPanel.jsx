import React, { useEffect, useState } from 'react';

const ActiveContainersPanel = () => {
  const [containers, setContainers] = useState([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchContainers = async () => {
      try {
        const res = await fetch('/api/active-containers');
        const data = await res.json();
        setContainers(data);
      } catch (err) {
        console.error('Failed to fetch containers:', err);
      }
    };

    fetchContainers();
    const interval = setInterval(fetchContainers, 5000);
    return () => clearInterval(interval);
  }, []);

  const createContainer = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/create-container', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Container created successfully:', result.containerName);
        
        // Refresh the containers list immediately
        const res = await fetch('/api/active-containers');
        const data = await res.json();
        setContainers(data);
      } else {
        const error = await response.json();
        console.error('Failed to create container:', error.message);
        alert(`Failed to create container: ${error.message}`);
      }
    } catch (error) {
      console.error('Error creating container:', error);
      alert(`Error creating container: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const stopContainer = async (containerId, containerName) => {
    try {
      const response = await fetch('/api/stop-container', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ containerId })
      });

      if (response.ok) {
        console.log(`Container ${containerName} stopped successfully`);
        // Remove the container from the list immediately for better UX
        setContainers(prevContainers => 
          prevContainers.filter(container => 
            (container.id || container.Id) !== containerId
          )
        );
      } else {
        const error = await response.json();
        console.error('Failed to stop container:', error.message);
        alert(`Failed to stop container: ${error.message}`);
      }
    } catch (error) {
      console.error('Error stopping container:', error);
      alert(`Error stopping container: ${error.message}`);
    }
  };

  const handleStopClick = (e, containerId, containerName) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Confirm before stopping
    if (window.confirm(`Are you sure you want to stop container "${containerName}"?`)) {
      stopContainer(containerId, containerName);
    }
  };

  // UPDATED: Enhanced port display and copy functionality
  const copyPortToClipboard = async (port, containerName) => {
    try {
      await navigator.clipboard.writeText(port.toString());
      alert(`Port ${port} copied to clipboard!\nUse this port in the SSH connection form.`);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = port.toString();
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert(`Port ${port} copied to clipboard!\nUse this port in the SSH connection form.`);
    }
  };

  // Helper function to get the public port
  const getPublicPort = (container) => {
    try {
      // Handle the raw Docker API response format
      if (container.Ports && Array.isArray(container.Ports) && container.Ports.length > 0) {
        // Look for the first port with PublicPort
        const portWithPublic = container.Ports.find(port => port.PublicPort);
        if (portWithPublic) {
          return portWithPublic.PublicPort;
        }
      }
      
      return 'N/A';
    } catch (error) {
      console.error('Error getting port:', error);
      return 'N/A';
    }
  };

  return (
    <div className="active-containers-content">
      {/* Header Section */}
      <div className="containers-header">
        <div className="header-title">
          <h3>Active Containers</h3>
          <span className="container-count">{containers.length} running</span>
        </div>
        <button
          onClick={createContainer}
          disabled={isCreating}
          className="create-container-btn"
        >
          {isCreating ? 'Creating...' : 'Create'}
        </button>
      </div>

      {/* Containers Grid */}
      <div className="containers-grid">
        {containers.length === 0 ? (
          <div className="no-containers">
            <div className="no-containers-icon">📦</div>
            <h4>No Active Containers</h4>
            <p>Click "Create" to start a new SSH container</p>
          </div>
        ) : (
          containers.map(container => {
            const containerId = container.id || container.Id;
            const name = container.name || container.Names?.[0]?.replace('/', '') || 'Unnamed';
            const image = container.image || container.Image || 'Unknown Image';
            const status = container.status || container.Status || 'Unknown';
            const state = container.state || container.State || 'Unknown';
            const createdTime = container.created || container.Created;
            const created = createdTime
              ? new Date(createdTime * 1000).toLocaleString()
              : 'N/A';
            const publicPort = getPublicPort(container);

            return (
              <div
                key={containerId}
                className="container-card"
              >
                {/* Container Header */}
                <div className="container-card-header">
                  <div className="container-name">
                    <span className="name-text">{name}</span>
                    <span className="container-id">{containerId.substring(0, 12)}</span>
                  </div>
                  <button
                    onClick={(e) => handleStopClick(e, containerId, name)}
                    className="stop-btn"
                    title={`Stop container: ${name}`}
                  >
                    ×
                  </button>
                </div>

                {/* Container Info */}
                <div className="container-info">
                  <div className="info-row">
                    <span className="info-label">Image:</span>
                    <span className="info-value">{image}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Status:</span>
                    <span className={`status-badge ${state.toLowerCase()}`}>{status}</span>
                  </div>
                  {/* UPDATED: Enhanced port display */}
                  <div className="info-row">
                    <span className="info-label">SSH Port:</span>
                    <span 
                      className="port-value clickable-port" 
                      onClick={() => copyPortToClipboard(publicPort, name)}
                      title="Click to copy port number"
                      style={{ 
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      {publicPort} 📋
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Created:</span>
                    <span className="info-value">{created}</span>
                  </div>
                </div>

                {/* UPDATED: Enhanced Quick Actions */}
                <div className="container-actions">
                  <button 
                    className="action-btn connect-btn" 
                    onClick={() => copyPortToClipboard(publicPort, name)}
                    title={`Copy SSH port ${publicPort} to clipboard`}
                  >
                    📋 Copy Port {publicPort}
                  </button>
                  <button className="action-btn logs-btn" title="View Logs">
                    📋 Logs
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActiveContainersPanel;