import { useState, useEffect } from 'react';
import { apiService } from '../api';
import SearchableDropdown from './SearchableDropdown';
import './ManagementStyles.css';

interface Role {
  id: number;
  roleName: string;
  roleType: string;
}

interface User {
  id: number;
  name: string;
  username: string;
}

interface UserRole {
  id: number;
  userId: number;
  roleId: number;
  userName: string;
  username: string;
  roleName: string;
  createdDate: string;
  updatedDate?: string;
}

export default function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showDeleteRoleConfirm, setShowDeleteRoleConfirm] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [roleFormData, setRoleFormData] = useState({
    roleName: '',
    roleType: ''
  });

  const [assignFormData, setAssignFormData] = useState({
    userId: 0,
    roleId: 0
  });

  // Fetch all data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const rolesRes = await apiService.getRoleDetails();
      const usersRes = await apiService.getUsers();
      const userRolesRes = await apiService.getUserRoles();
      
      setRoles(rolesRes.data);
      setUsers(usersRes.data);
      setUserRoles(userRolesRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle role form submit
  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      if (editingRole) {
        await apiService.updateRoleDetail(editingRole.id, roleFormData);
        setSuccessMessage('Role updated successfully!');
      } else {
        await apiService.createRoleDetail(roleFormData);
        setSuccessMessage('Role created successfully!');
      }

      setShowRoleForm(false);
      setEditingRole(null);
      setRoleFormData({ roleName: '', roleType: '' });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setLoading(false);
    }
  };

  // Handle assign role submit
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      await apiService.createUserRole(assignFormData);
      setSuccessMessage('Role assigned successfully!');
      setShowAssignForm(false);
      setAssignFormData({ userId: 0, roleId: 0 });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign role');
    } finally {
      setLoading(false);
    }
  };

  // Delete role from user
  const handleDeleteUserRole = async (id: number) => {
    try {
      setLoading(true);
      await apiService.deleteUserRole(id);
      setSuccessMessage('Role removed from user successfully!');
      setShowDeleteConfirm(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove role');
    } finally {
      setLoading(false);
    }
  };

  // Delete role
  const handleDeleteRole = async (id: number) => {
    try {
      setLoading(true);
      await apiService.deleteRoleDetail(id);
      setSuccessMessage('Role deleted successfully!');
      setShowDeleteRoleConfirm(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    } finally {
      setLoading(false);
    }
  };

  // Edit role
  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleFormData({
      roleName: role.roleName,
      roleType: role.roleType
    });
    setShowRoleForm(true);
  };

  // Filter user roles by search
  const filteredUserRoles = userRoles.filter(ur =>
    ur.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ur.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ur.roleName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group user roles by user
  const groupedByUser = filteredUserRoles.reduce((groups: { [key: number]: { userName: string; username: string; roles: UserRole[] } }, userRole) => {
    const userId = userRole.userId;
    if (!groups[userId]) {
      groups[userId] = {
        userName: userRole.userName,
        username: userRole.username,
        roles: []
      };
    }
    groups[userId].roles.push(userRole);
    return groups;
  }, {});

  const sortedUsers = Object.keys(groupedByUser).sort((a, b) => {
    const userAName = groupedByUser[Number(a)].userName;
    const userBName = groupedByUser[Number(b)].userName;
    return userAName.localeCompare(userBName);
  });

  return (
    <div className="management-container roles-container">
      <h2 className="section-heading">Roles & Access</h2>
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="management-section">
        <h2>📋 Role Management</h2>

        <div className="toolbar">
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingRole(null);
              setRoleFormData({ roleName: '', roleType: '' });
              setShowRoleForm(true);
            }}
          >
            + Add New Role
          </button>
        </div>

        {showRoleForm && (
          <div className="form-container">
            <h3>{editingRole ? 'Edit Role' : 'Add New Role'}</h3>
            <form onSubmit={handleRoleSubmit}>
              <input
                type="text"
                placeholder="Role Name (e.g., Admin, Manager)"
                value={roleFormData.roleName}
                onChange={(e) => setRoleFormData({ ...roleFormData, roleName: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Role Type (e.g., System, Custom)"
                value={roleFormData.roleType}
                onChange={(e) => setRoleFormData({ ...roleFormData, roleType: e.target.value })}
                required
              />
              <div className="form-buttons">
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Role'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRoleForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="loading-spinner"></div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Role Name</th>
                  <th>Role Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td>{role.roleName}</td>
                    <td>{role.roleType}</td>
                    <td className="actions">
                      <button className="btn btn-sm btn-info" onClick={() => handleEditRole(role)}>
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => setShowDeleteRoleConfirm(role.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="management-section">
        <h2>👥 User Role Assignment</h2>

        <div className="toolbar">
          <input
            type="text"
            placeholder="Search users or roles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button
            className="btn btn-primary"
            onClick={() => {
              setAssignFormData({ userId: 0, roleId: 0 });
              setShowAssignForm(true);
            }}
          >
            + Assign Role to User
          </button>
        </div>

        {showAssignForm && (
          <div className="form-container">
            <h3>Assign Role to User</h3>
            <form onSubmit={handleAssignSubmit}>
              <SearchableDropdown
                value={assignFormData.userId || null}
                onChange={(option) => setAssignFormData({ ...assignFormData, userId: option.id as number })}
                options={users.map((user) => ({
                  id: user.id,
                  label: `${user.name} (${user.username})`
                }))}
                placeholder="Select User"
              />
              <SearchableDropdown
                value={assignFormData.roleId || null}
                onChange={(option) => setAssignFormData({ ...assignFormData, roleId: option.id as number })}
                options={roles.map((role) => ({
                  id: role.id,
                  label: role.roleName
                }))}
                placeholder="Select Role"
              />
              <div className="form-buttons">
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading ? 'Assigning...' : 'Assign Role'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="loading-spinner"></div>
        ) : sortedUsers.length === 0 ? (
          <div className="no-results-message">
            <p>No user roles found.</p>
          </div>
        ) : (
          <div>
            {sortedUsers.map((userId) => (
              <div key={userId} className="user-roles-section">
                <div className="user-roles-header">
                  <h3>👤 {groupedByUser[Number(userId)].userName}</h3>
                  <span className="role-count">({groupedByUser[Number(userId)].roles.length} roles)</span>
                </div>
                <div className="roles-badges">
                  {groupedByUser[Number(userId)].roles.map((userRole) => (
                    <div key={userRole.id} className="role-badge">
                      <span className="role-name">{userRole.roleName}</span>
                      <button
                        className="btn-remove"
                        onClick={() => setShowDeleteConfirm(userRole.id)}
                        title="Remove this role"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to remove this role from the user?</p>
            <div className="modal-buttons">
              <button
                className="btn btn-danger"
                onClick={() => handleDeleteUserRole(showDeleteConfirm)}
              >
                Remove
              </button>
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteRoleConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this role? This action cannot be undone.</p>
            <div className="modal-buttons">
              <button
                className="btn btn-danger"
                onClick={() => handleDeleteRole(showDeleteRoleConfirm)}
              >
                Delete
              </button>
              <button className="btn btn-secondary" onClick={() => setShowDeleteRoleConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
