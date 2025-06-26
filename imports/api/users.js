// imports/api/users.js
import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import bcrypt from 'bcryptjs';

export const AppUsers = new Mongo.Collection('appUsers');

if (Meteor.isServer) {
  // Create indexes for better performance
  Meteor.startup(() => {
    AppUsers.createIndexAsync({ email: 1 }, { unique: true });
    AppUsers.createIndexAsync({ username: 1 }, { unique: true });
    AppUsers.createIndexAsync({ role: 1 });
    AppUsers.createIndexAsync({ isActive: 1 });
  });

  // Publications
  Meteor.publish('currentUser', function() {
    if (!this.userId) return this.ready();
    
    return AppUsers.find({ _id: this.userId }, {
      fields: {
        email: 1,
        username: 1,
        role: 1,
        firstName: 1,
        lastName: 1,
        isActive: 1,
        createdAt: 1,
        lastLoginAt: 1
      }
    });
  });

  Meteor.publish('allUsers', function() {
    // Only admins can see all users
    const currentUser = AppUsers.findOne({ _id: this.userId });
    if (!currentUser || currentUser.role !== 'admin') {
      return this.ready();
    }
    
    return AppUsers.find({}, {
      fields: {
        email: 1,
        username: 1,
        role: 1,
        firstName: 1,
        lastName: 1,
        isActive: 1,
        createdAt: 1,
        lastLoginAt: 1
      },
      sort: { createdAt: -1 }
    });
  });

  // Server Methods
  Meteor.methods({
    async 'users.signup'(userData) {
      check(userData, {
        email: String,
        username: String,
        firstName: String,
        lastName: String,
        password: String,
        confirmPassword: String,
        role: String
      });

      const { email, username, firstName, lastName, password, confirmPassword, role } = userData;

      // Validation
      if (password !== confirmPassword) {
        throw new Meteor.Error('password-mismatch', 'Passwords do not match');
      }

      // Password strength validation
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(password)) {
        throw new Meteor.Error('weak-password', 
          'Password must be at least 8 characters with uppercase, lowercase, number, and special character');
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Meteor.Error('invalid-email', 'Please enter a valid email address');
      }

      // Role validation
      if (!['user', 'admin'].includes(role.toLowerCase())) {
        throw new Meteor.Error('invalid-role', 'Role must be either user or admin');
      }

      // Check if email already exists
      const existingEmail = await AppUsers.findOneAsync({ email: email.toLowerCase() });
      if (existingEmail) {
        throw new Meteor.Error('email-exists', 'Email already registered');
      }

      // Check if username already exists
      const existingUsername = await AppUsers.findOneAsync({ username: username.toLowerCase() });
      if (existingUsername) {
        throw new Meteor.Error('username-exists', 'Username already taken');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const userId = await AppUsers.insertAsync({
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password: hashedPassword,
        role: role.toLowerCase(),
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: null
      });

      console.log(`New ${role} registered: ${username} (${email})`);

      return {
        success: true,
        message: 'Account created successfully! Please sign in.',
        userId: userId
      };
    },

    async 'users.signin'(credentials) {
      check(credentials, {
        username: String,
        password: String
      });

      const { username, password } = credentials;

      // Find user by username
      const user = await AppUsers.findOneAsync({ 
        username: username.toLowerCase(),
        isActive: true 
      });

      if (!user) {
        throw new Meteor.Error('invalid-credentials', 'Invalid username or password');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Meteor.Error('invalid-credentials', 'Invalid username or password');
      }

      // Update last login
      await AppUsers.updateAsync(user._id, {
        $set: { lastLoginAt: new Date() }
      });

      console.log(`User signed in: ${user.username} (${user.role})`);

      return {
        success: true,
        user: {
          _id: user._id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          lastLoginAt: new Date()
        }
      };
    },

    async 'users.signout'() {
      // Method to handle any cleanup on signout
      return { success: true };
    },

    async 'users.changePassword'(passwordData) {
      check(passwordData, {
        currentPassword: String,
        newPassword: String,
        confirmNewPassword: String
      });

      if (!this.userId) {
        throw new Meteor.Error('not-authorized', 'Must be logged in');
      }

      const { currentPassword, newPassword, confirmNewPassword } = passwordData;

      if (newPassword !== confirmNewPassword) {
        throw new Meteor.Error('password-mismatch', 'New passwords do not match');
      }

      // Password strength validation
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        throw new Meteor.Error('weak-password', 
          'Password must be at least 8 characters with uppercase, lowercase, number, and special character');
      }

      // Get current user
      const user = await AppUsers.findOneAsync({ _id: this.userId });
      if (!user) {
        throw new Meteor.Error('user-not-found', 'User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new Meteor.Error('invalid-password', 'Current password is incorrect');
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await AppUsers.updateAsync(user._id, {
        $set: { 
          password: hashedNewPassword,
          passwordChangedAt: new Date()
        }
      });

      return { success: true, message: 'Password updated successfully' };
    },

    async 'users.updateProfile'(profileData) {
      check(profileData, {
        firstName: String,
        lastName: String,
        email: String
      });

      if (!this.userId) {
        throw new Meteor.Error('not-authorized', 'Must be logged in');
      }

      const { firstName, lastName, email } = profileData;

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Meteor.Error('invalid-email', 'Please enter a valid email address');
      }

      // Check if email is taken by another user
      const existingUser = await AppUsers.findOneAsync({ 
        email: email.toLowerCase(),
        _id: { $ne: this.userId }
      });
      if (existingUser) {
        throw new Meteor.Error('email-exists', 'Email already taken by another user');
      }

      // Update profile
      await AppUsers.updateAsync(this.userId, {
        $set: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.toLowerCase(),
          updatedAt: new Date()
        }
      });

      return { success: true, message: 'Profile updated successfully' };
    },

    async 'users.getStats'() {
      const totalUsers = await AppUsers.find().countAsync();
      const activeUsers = await AppUsers.find({ isActive: true }).countAsync();
      const adminUsers = await AppUsers.find({ role: 'admin' }).countAsync();
      const regularUsers = await AppUsers.find({ role: 'user' }).countAsync();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayUsers = await AppUsers.find({ 
        createdAt: { $gte: today } 
      }).countAsync();

      return {
        totalUsers,
        activeUsers,
        adminUsers,
        regularUsers,
        todayUsers
      };
    }
  });
}

// Helper functions
export const UserHelpers = {
  getCurrentUser() {
    if (Meteor.isClient) {
      const userId = Session.get('currentUserId');
      return userId ? AppUsers.findOne(userId) : null;
    }
    return null;
  },

  isLoggedIn() {
    if (Meteor.isClient) {
      return !!Session.get('currentUserId');
    }
    return false;
  },

  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.role === 'admin';
  },

  getFullName(user) {
    if (!user) return 'Unknown User';
    return `${user.firstName} ${user.lastName}`.trim();
  },

  formatRole(role) {
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'User';
  }
};