import React, { useState } from 'react';
import ServiceSelectionPage from './components/ServiceSelectionPage';
import VMTerminal from './components/VMTerminal';
import TerminalComponent from '../../client/TerminalComponent';

declare global {
  interface Window {
    SimpleCalculator?: React.ComponentType<any>;
  }
}

export const App = () => {
  const [currentService, setCurrentService] = useState<string | null>(null);

  const handleServiceSelect = (service: string) => {
    setCurrentService(service);
  };

  const handleBack = () => {
    setCurrentService(null);
  };

  const renderCurrentView = () => {
    switch (currentService) {
      case 'vm':
        return <VMTerminal onBack={handleBack} />;
      
      case 'containers':
        return <TerminalComponent onBack={handleBack} />;
      
      case 'calculator':
        return (
          <div style={{ padding: '20px' }}>
            <button 
              onClick={handleBack} 
              style={{ 
                marginBottom: '20px',
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              ← Back to Services
            </button>
            
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {typeof (globalThis as any).SimpleCalculator !== 'undefined' ? (
                React.createElement((globalThis as any).SimpleCalculator, {
                  onCalculation: (result: any) => {
                    console.log('Calculation result:', result);
                  }
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
                  <p>Loading calculator...</p>
                </div>
              )}
            </div>
          </div>
        );
      
      default:
        return <ServiceSelectionPage onServiceSelect={handleServiceSelect} />;
    }
  };

  return (
    <div className="app"> 
      {renderCurrentView()}
    </div>
  );
};