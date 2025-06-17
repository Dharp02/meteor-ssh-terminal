import React, { useEffect, useState } from 'react';

const ActiveContainersPanel = () => {
  const [containers, setContainers] = useState([]);

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
        // Remove the container from the list immediately 
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

  return (
    <div style={{ background: '#1e1e1e', color: '#fff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
      <h3 style={{ marginBottom: '1rem' }}>Active Containers</h3>

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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActiveContainersPanel;