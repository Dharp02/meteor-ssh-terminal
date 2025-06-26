// imports/ui/components/AuthPage.jsx
import React, { useState } from 'react';
import SignupForm from './SignupForm';
import SigninForm from './SigninForm';
import './auth.css';

const AuthPage = ({ onAuthSuccess }) => {
  const [currentView, setCurrentView] = useState('signin'); // 'signin' or 'signup'

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>SSH Terminal</h1>
          <p>Secure Web-Based Terminal Access</p>
        </div>

        <div className="auth-tabs">
          <button 
            className={`auth-tab ${currentView === 'signin' ? 'active' : ''}`}
            onClick={() => setCurrentView('signin')}
          >
            Sign In
          </button>
          <button 
            className={`auth-tab ${currentView === 'signup' ? 'active' : ''}`}
            onClick={() => setCurrentView('signup')}
          >
            Sign Up
          </button>
        </div>

        <div className="auth-form-container">
          {currentView === 'signin' ? (
            <SigninForm 
              onSuccess={onAuthSuccess}
              onSwitchToSignup={() => setCurrentView('signup')}
            />
          ) : (
            <SignupForm 
              onSuccess={() => setCurrentView('signin')}
              onSwitchToSignin={() => setCurrentView('signin')}
            />
          )}
        </div>

        <div className="auth-footer">
          <p>&copy; 2025 SSH Terminal. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;