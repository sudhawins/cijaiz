import { useState, useEffect } from 'react';
import { apiService } from '../api';
import './UserManagement.css';

interface User {
  id: number;
  userName: string;
  password?: string;
  name: string;
  createdDate: string;
  updatedDate?: string;
  nextLoginDuration?: number;
}

interface RoleDetail {
  id: number;
  roleName: string;
  roleType: string;
}

interface UserRole {
  id: number;
  userId: number;
  roleId: number;
  createdDate: string;
  updatedDate?: string;
  user?: User;
  role?: RoleDetail;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleDetail[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<RoleDetail | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'user' | 'role'; id: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'user-roles'>('users');

  const [userFormData, setUserFormData] = useState({
    userName: '',
    password: '',
    name: '',
    nextLoginDuration: 30
  });

  const [roleFormData, setRoleFormData] = useState({
    roleName: '',
    roleType: ''
  });

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getUsers();
      setUsers(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  // Fetch roles
  const fetchRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getRoleDetails();
      setRoles(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  };

  // Fetch user roles
  const fetchUserRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getUserRoles();
      setUserRoles(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'roles') fetchRoles();
    else fetchUserRoles();
  }, [activeTab]);

  // Handle user form submit
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      if (editingUser) {
        await apiService.updateUser(editingUser.id, userFormData);
        setSuccessMessage('User updated successfully!');
      } else {
        await apiService.createUser(userFormData);
        setSuccessMessage('User created successfully!');
      }

      setShowUserForm(false);
      setEditingUser(null);
      setUserFormData({ userName: '', password: '', name: '', nextLoginDuration: 30 });
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

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
      fetchRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setLoading(false);
    }
  };

  // Delete user
  const handleDeleteUser = async (id: number) => {
    try {
      setLoading(true);
      await apiService.deleteUser(id);
      setSuccessMessage('User deleted successfully!');
      setShowDeleteConfirm(null);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
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
      setShowDeleteConfirm(null);
      fetchRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    } finally {
      setLoading(false);
    }
  };

  // Edit user
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserFormData({
      userName: user.userName,
      password: '',
      name: user.name,
      nextLoginDuration: user.nextLoginDuration || 30
    });
    setShowUserForm(true);
  };

  // Edit role
  const handleEditRole = (role: RoleDetail) => {
    setEditingRole(role);
    setRoleFormData({
      roleName: role.roleName,
      roleType: role.roleType
    });
    setShowRoleForm(true);
  };

  const filteredUsers = users.filter(user =>
    user.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRoles = roles.filter(role =>
    role.roleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.roleType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="user-management-container users-container">
      <h2 className="section-heading">Users</h2>
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button
          className={`tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          Roles
        </button>
        <button
          className={`tab-btn ${activeTab === 'user-roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('user-roles')}
        >
          User Roles
        </button>
      </div>

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="tab-content">
          <div className="toolbar">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingUser(null);
                setUserFormData({ userName: '', password: '', name: '', nextLoginDuration: 30 });
                setShowUserForm(true);
              }}
            >
              + Add User
            </button>
          </div>

          {showUserForm && (
            <div className="form-container">
              <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
              <form onSubmit={handleUserSubmit}>
                <input
                  type="text"
                  placeholder="Username"
                  value={userFormData.userName}
                  onChange={(e) => setUserFormData({ ...userFormData, userName: e.target.value })}
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  required={!editingUser}
                />
                <input
                  type="text"
                  placeholder="Full Name"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  required
                />
                <input
                  type="number"
                  placeholder="Next Login Duration (days)"
                  value={userFormData.nextLoginDuration}
                  onChange={(e) => setUserFormData({ ...userFormData, nextLoginDuration: parseInt(e.target.value) })}
                />
                <div className="form-buttons">
                  <button type="submit" className="btn btn-success" disabled={loading}>
                    {loading ? 'Saving...' : 'Save User'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowUserForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="loading-spinner"></div>
          ) : (
            <div className="items-grid">
              {filteredUsers.map((user) => (
                <div key={user.id} className="item-card">
                  <div className="item-header">
                    <h4>{user.name}</h4>
                    <div className="item-actions">
                      <button
                        className="btn btn-sm btn-info"
                        onClick={() => handleEditUser(user)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => setShowDeleteConfirm({ type: 'user', id: user.id })}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p><strong>Username:</strong> {user.userName}</p>
                  <p><strong>Password:</strong> {user.password}</p>
                  <p><strong>Login Duration:</strong> {user.nextLoginDuration || 'N/A'} days</p>
                  <p><strong>Created:</strong> {new Date(user.createdDate).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ROLES TAB */}
      {activeTab === 'roles' && (
        <div className="tab-content">
          <div className="toolbar">
            <input
              type="text"
              placeholder="Search roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingRole(null);
                setRoleFormData({ roleName: '', roleType: '' });
                setShowRoleForm(true);
              }}
            >
              + Add Role
            </button>
          </div>

          {showRoleForm && (
            <div className="form-container">
              <h3>{editingRole ? 'Edit Role' : 'Add New Role'}</h3>
              <form onSubmit={handleRoleSubmit}>
                <input
                  type="text"
                  placeholder="Role Name"
                  value={roleFormData.roleName}
                  onChange={(e) => setRoleFormData({ ...roleFormData, roleName: e.target.value })}
                  required
                />
                <input
                  type="text"
                  placeholder="Role Type"
                  value={roleFormData.roleType}
                  onChange={(e) => setRoleFormData({ ...roleFormData, roleType: e.target.value })}
                  required
                />
                <div className="form-buttons">
                  <button type="submit" className="btn btn-success" disabled={loading}>
                    {loading ? 'Saving...' : 'Save Role'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowRoleForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="loading-spinner"></div>
          ) : (
            <div className="items-grid">
              {filteredRoles.map((role) => (
                <div key={role.id} className="item-card">
                  <div className="item-header">
                    <h4>{role.roleName}</h4>
                    <div className="item-actions">
                      <button
                        className="btn btn-sm btn-info"
                        onClick={() => handleEditRole(role)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => setShowDeleteConfirm({ type: 'role', id: role.id })}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p><strong>Type:</strong> {role.roleType}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* USER ROLES TAB */}
      {activeTab === 'user-roles' && (
        <div className="tab-content">
          {loading ? (
            <div className="loading-spinner"></div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {userRoles.map((ur) => (
                    <tr key={ur.id}>
                      <td>{ur.user?.name || 'N/A'}</td>
                      <td>{ur.role?.roleName || 'N/A'}</td>
                      <td>{new Date(ur.createdDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this {showDeleteConfirm.type}?</p>
            <div className="modal-buttons">
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (showDeleteConfirm.type === 'user') {
                    handleDeleteUser(showDeleteConfirm.id);
                  } else {
                    handleDeleteRole(showDeleteConfirm.id);
                  }
                }}
              >
                Delete
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
