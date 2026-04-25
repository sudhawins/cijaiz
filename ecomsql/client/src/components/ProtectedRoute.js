import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated, hasRole, hasAnyRole } from '../utils/authUtils';

// Component to protect routes that require authentication
export const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Component to protect routes that require specific role(s)
export const RoleBasedRoute = ({ children, requiredRole }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // Support both single role (string) and multiple roles (array)
  const isAuthorized = Array.isArray(requiredRole) 
    ? hasAnyRole(requiredRole) 
    : hasRole(requiredRole);

  if (!isAuthorized) {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const roleDisplay = Array.isArray(requiredRole) 
      ? requiredRole.join(' or ') 
      : requiredRole;
    
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '20px',
        background: '#f5f5f5'
      }}>
        <h2 style={{ color: '#d32f2f', marginBottom: '10px' }}>Access Restricted</h2>
        <p style={{ color: '#666', marginBottom: '5px' }}>
          You need <strong>{roleDisplay}</strong> role to access this page.
        </p>
        <p style={{ color: '#999', fontSize: '14px', marginBottom: '20px' }}>
          Your current role: <strong>{currentUser.roleType || 'None'}</strong>
        </p>
        <button
          onClick={() => window.location.href = '/'}
          style={{
            padding: '10px 20px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Go Back Home
        </button>
      </div>
    );
  }

  return children;
};

// Component to protect routes that require any of the specified roles
export const MultiRoleRoute = ({ children, requiredRoles }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (!hasAnyRole(requiredRoles)) {
    return <Navigate to="/" replace />;
  }

  return children;
};
