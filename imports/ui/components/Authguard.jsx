// imports/ui/components/AuthGuard.jsx
import React, { useState, useEffect } from 'react';
import { Session } from 'meteor/session';
import AuthPage from './AuthPage';
import { AppUsers } from '../../api/users';

const AuthGuard = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Check if user is already logged in
    const userId = Session.get('currentUserId');
    const userData = Session.get('currentUser');
    
    if (userId && userData) {
      setCurrentUser(userData);
      setIsAuthenticated(true);
    }
    
    setIsLoading(false);
  }, []);

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    Session.set('currentUserId', null);
    Session.set('currentUser', null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    
    // Call logout method for any cleanup
    Meteor.call('users.signout', (error) => {
      if (error) {
        console.error('Logout error:', error);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  // Add user context to children
  return React.cloneElement(children, { 
    currentUser, 
    onLogout: handleLogout 
  });
};

export default AuthGuard;