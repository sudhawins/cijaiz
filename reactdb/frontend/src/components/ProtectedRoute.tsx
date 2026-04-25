import { ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];
  requireAll?: boolean;
}

/**
 * ProtectedRoute Component
 * 
 * Restricts access to routes based on user roles
 * @param children - Component to render if authorized
 * @param requiredRoles - Array of roles required to access (any role by default)
 * @param requireAll - If true, user must have ALL roles; if false, user needs ANY role
 */
export function ProtectedRoute({ 
  children, 
  requiredRoles = [], 
  requireAll = false 
}: ProtectedRouteProps) {
  const { isAuthenticated, user, hasAnyRole, hasRole } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  // If no roles required, allow access
  if (requiredRoles.length === 0) {
    return <>{children}</>;
  }

  // Check if user has required roles
  const hasAccess = requireAll
    ? requiredRoles.every(role => hasRole(role))
    : hasAnyRole(requiredRoles);

  if (!hasAccess) {
    return (
      <div className="access-denied">
        <div className="access-denied-content">
          <h2>🔒 Access Denied</h2>
          <p>You do not have permission to access this page.</p>
          <p className="user-info">
            Current User: <strong>{user?.name || user?.username}</strong><br/>
            Current Roles: <strong>{user?.roles || 'None'}</strong>
          </p>
          <p className="required-roles">
            Required Roles: <strong>{requiredRoles.join(', ')}</strong>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
