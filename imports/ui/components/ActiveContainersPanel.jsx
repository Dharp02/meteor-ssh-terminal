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
    <div style={{ background: '#1e1e1e', color: '#fff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Active Containers</h3>
        <button
          onClick={createContainer}
          disabled={isCreating}
          style={{
            background: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            cursor: isCreating ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            transition: 'all 0.2s ease',
            opacity: isCreating ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!isCreating) {
              e.target.style.background = '#2ecc71';
              e.target.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isCreating) {
              e.target.style.background = '#27ae60';
              e.target.style.transform = 'translateY(0)';
            }
          }}
        >
          {isCreating ? 'Creating...' : 'Create'}
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          overflowX: 'auto',
          overflowY: 'hidden',
          gap: '1rem',
          paddingBottom: '0.5rem',
          whiteSpace: 'nowrap'
        }}
      >
        {containers.length === 0 ? (
          <p style={{ color: '#aaa' }}>No running containers</p>
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
                style={{
                  background: '#2c2c2c',
                  padding: '1rem',
                  borderRadius: '8px',
                  minWidth: '250px',
                  maxWidth: '250px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  flex: '0 0 auto',
                  position: 'relative' // For positioning the X button
                }}
              >
                {/* X Button - positioned at top right */}
                <button
                  onClick={(e) => handleStopClick(e, containerId, name)}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: '1',
                    transition: 'all 0.2s ease',
                    zIndex: 10
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#c0392b';
                    e.target.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#e74c3c';
                    e.target.style.transform = 'scale(1)';
                  }}
                  title={`Stop container: ${name}`}
                >
                  ×
                </button>

                {/* Container Info */}
                <strong style={{ fontSize: '16px', paddingRight: '30px' }}>{name}</strong>
                <p style={{ margin: '4px 0' }}><em>{image}</em></p>
                <p style={{ margin: '4px 0' }}>Status: <strong>{status}</strong></p>
                <p style={{ margin: '4px 0' }}>State: {state}</p>
                <p style={{ margin: '4px 0' }}>Started: {created}</p>
                <p style={{ margin: '4px 0' }}>Port: <strong>{publicPort}</strong></p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActiveContainersPanel;