// imports/ui/components/SigninForm.jsx
import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';

const SigninForm = ({ onSuccess, onSwitchToSignup }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username) {
      newErrors.username = 'Username is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const result = await new Promise((resolve, reject) => {
        Meteor.call('users.signin', formData, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      });

      // Store user session
      Session.set('currentUserId', result.user._id);
      Session.set('currentUser', result.user);
      
      console.log('Signin successful:', result.user);
      onSuccess(result.user);
    } catch (error) {
      console.error('Signin error:', error);
      
      if (error.error === 'invalid-credentials') {
        setErrors({ general: 'Invalid username or password' });
      } else {
        setErrors({ general: error.reason || 'Failed to sign in. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h2>Welcome Back</h2>
      <p className="auth-subtitle">Sign in to access your SSH terminal</p>
      
      {errors.general && (
        <div className="error-message general-error">
          {errors.general}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="username">Username</label>
        <input
          type="text"
          id="username"
          name="username"
          value={formData.username}
          onChange={handleInputChange}
          className={errors.username ? 'error' : ''}
          placeholder="Enter your username"
          disabled={isLoading}
          required
          autoComplete="username"
        />
        {errors.username && <span className="error-text">{errors.username}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="password">Password</label>
        <div className="password-input-container">
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            className={errors.password ? 'error' : ''}
            placeholder="Enter your password"
            disabled={isLoading}
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            disabled={isLoading}
          >
            {showPassword ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>
        {errors.password && <span className="error-text">{errors.password}</span>}
      </div>

      <button 
        type="submit" 
        className="auth-button primary"
        disabled={isLoading}
      >
        {isLoading ? 'Signing In...' : 'Sign In'}
      </button>

      <div className="auth-switch">
        <p>
          Don't have an account?{' '}
          <button 
            type="button" 
            className="link-button"
            onClick={onSwitchToSignup}
            disabled={isLoading}
          >
            Sign Up
          </button>
        </p>
      </div>
    </form>
  );
};

export default SigninForm;
