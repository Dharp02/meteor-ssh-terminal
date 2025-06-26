// imports/ui/components/SignupForm.jsx
import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';

const SignupForm = ({ onSuccess, onSwitchToSignin }) => {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    role: 'user'
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

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Username validation
    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    // Name validation
    if (!formData.firstName) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName) {
      newErrors.lastName = 'Last name is required';
    }

    // Password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!passwordRegex.test(formData.password)) {
      newErrors.password = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      await new Promise((resolve, reject) => {
        Meteor.call('users.signup', formData, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      });

      // Success
      alert('Account created successfully! Please sign in.');
      onSuccess();
    } catch (error) {
      console.error('Signup error:', error);
      
      if (error.error === 'email-exists') {
        setErrors({ email: 'Email already registered' });
      } else if (error.error === 'username-exists') {
        setErrors({ username: 'Username already taken' });
      } else if (error.error === 'weak-password') {
        setErrors({ password: error.reason });
      } else {
        setErrors({ general: error.reason || 'Failed to create account. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h2>Create Account</h2>
      
      {errors.general && (
        <div className="error-message general-error">
          {errors.general}
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="firstName">First Name *</label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={formData.firstName}
            onChange={handleInputChange}
            className={errors.firstName ? 'error' : ''}
            placeholder="Enter your first name"
            disabled={isLoading}
            required
          />
          {errors.firstName && <span className="error-text">{errors.firstName}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="lastName">Last Name *</label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={formData.lastName}
            onChange={handleInputChange}
            className={errors.lastName ? 'error' : ''}
            placeholder="Enter your last name"
            disabled={isLoading}
            required
          />
          {errors.lastName && <span className="error-text">{errors.lastName}</span>}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="email">Email Address *</label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleInputChange}
          className={errors.email ? 'error' : ''}
          placeholder="Enter your email address"
          disabled={isLoading}
          required
        />
        {errors.email && <span className="error-text">{errors.email}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="username">Username *</label>
        <input
          type="text"
          id="username"
          name="username"
          value={formData.username}
          onChange={handleInputChange}
          className={errors.username ? 'error' : ''}
          placeholder="Choose a username"
          disabled={isLoading}
          required
        />
        {errors.username && <span className="error-text">{errors.username}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="password">Password *</label>
          <div className="password-input-container">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className={errors.password ? 'error' : ''}
              placeholder="Create a strong password"
              disabled={isLoading}
              required
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

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password *</label>
          <input
            type={showPassword ? 'text' : 'password'}
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            className={errors.confirmPassword ? 'error' : ''}
            placeholder="Confirm your password"
            disabled={isLoading}
            required
          />
          {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="role">Account Type *</label>
        <select
          id="role"
          name="role"
          value={formData.role}
          onChange={handleInputChange}
          className="role-select"
          disabled={isLoading}
          required
        >
          <option value="user">User - Standard Access</option>
          <option value="admin">Admin - Administrative Access</option>
        </select>
      </div>

      <div className="password-requirements">
        <p>Password Requirements:</p>
        <ul>
          <li>At least 8 characters long</li>
          <li>Contains uppercase and lowercase letters</li>
          <li>Contains at least one number</li>
          <li>Contains at least one special character (@$!%*?&)</li>
        </ul>
      </div>

      <button 
        type="submit" 
        className="auth-button primary"
        disabled={isLoading}
      >
        {isLoading ? 'Creating Account...' : 'Create Account'}
      </button>

      <div className="auth-switch">
        <p>
          Already have an account?{' '}
          <button 
            type="button" 
            className="link-button"
            onClick={onSwitchToSignin}
            disabled={isLoading}
          >
            Sign In
          </button>
        </p>
      </div>
    </form>
  );
};

export default SignupForm;