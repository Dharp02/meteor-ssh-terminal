import React, { useState, useRef, useEffect } from 'react';
import { UserHelpers } from '../../api/users';

const UserMenu = ({ currentUser, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    setIsOpen(false);
    onLogout();
  };

  if (!currentUser) return null;

  return (
    <div className="user-menu" ref={menuRef}>
      <button 
        className="user-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="User Menu"
      >
        <div className="user-avatar">
          {currentUser.firstName?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="user-info">
          <span className="user-name">
            {UserHelpers.getFullName(currentUser)}
          </span>
          <span className="user-role">
            {UserHelpers.formatRole(currentUser.role)}
          </span>
        </div>
        <svg 
          className={`dropdown-arrow ${isOpen ? 'open' : ''}`}
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none"
        >
          <path 
            d="M6 9L12 15L18 9" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">
            <div className="user-avatar large">
              {currentUser.firstName?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="user-details">
              <p className="user-full-name">
                {UserHelpers.getFullName(currentUser)}
              </p>
              <p className="user-email">{currentUser.email}</p>
              <span className="user-role-badge">
                {UserHelpers.formatRole(currentUser.role)}
              </span>
            </div>
          </div>
          
          <div className="user-menu-divider"></div>
          
          <div className="user-menu-items">
            <button className="user-menu-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M20 21V19C20 16.7909 18.2091 15 16 15H8C5.79086 15 4 16.7909 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
              </svg>
              Profile Settings
            </button>
            
            <button className="user-menu-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 1L3 5L12 9L21 5L12 1Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 17L12 21L21 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 12L12 16L21 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Session History
            </button>
            
            <button className="user-menu-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 1L3 5L12 9L21 5L12 1Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 17L12 21L21 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 12L12 16L21 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Settings
            </button>
          </div>
          
          <div className="user-menu-divider"></div>
          
          <button className="user-menu-item logout" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;