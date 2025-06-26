import React, { useState } from 'react';
import ServiceSelectionPage from './components/ServiceSelectionPage';
import VMTerminal from './components/VMTerminal';
import TerminalComponent from '../../client/TerminalComponent';

export const App = () => {
  const [currentService, setCurrentService] = useState(null);

  const handleServiceSelect = (service) => {
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