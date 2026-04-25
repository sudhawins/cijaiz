# Integration Guide: Adding Authentication to the App

This guide explains how to integrate the authentication system into your existing React application.

## Step 1: Update App.js to Include Routes and Auth Components

Replace or update your App.js to use React Router and include the auth components:

```javascript
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProductListing from './components/ProductListing';
import ProductUpload from './components/ProductUpload';
import ImageUpload from './components/ImageUpload';
import ShoppingCart from './components/ShoppingCart';
import OrderManagement from './components/OrderManagement';
import Login from './components/Login';
import Register from './components/Register';
import UserProfile from './components/UserProfile';
import { ProtectedRoute, RoleBasedRoute } from './components/ProtectedRoute';
import { getUser, isAuthenticated } from './utils/authUtils';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('products');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Load user on app startup
    const storedUser = getUser();
    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainApp 
                user={user} 
                onLogout={handleLogout} 
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

function MainApp({ user, onLogout, currentPage, setCurrentPage, searchQuery, setSearchQuery }) {
  const renderPage = () => {
    switch (currentPage) {
      case 'products':
        return <ProductListing />;
      case 'upload':
        return <RoleBasedRoute requiredRole="Seller"><ProductUpload /></RoleBasedRoute>;
      case 'images':
        return <RoleBasedRoute requiredRole="Seller"><ImageUpload /></RoleBasedRoute>;
      case 'cart':
        return <ShoppingCart />;
      case 'orders':
        return <OrderManagement />;
      case 'profile':
        return <UserProfile />;
      default:
        return <ProductListing />;
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-container">
          <div className="header-content">
            <h1>🛍️ ShopHub</h1>
          </div>

          <div className="header-search">
            <input
              type="text"
              placeholder="Search for products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button>Search</button>
          </div>

          <div className="header-icons">
            <div className="header-icon" onClick={() => setCurrentPage('cart')} style={{ cursor: 'pointer' }}>
              🛒 Cart
            </div>
            <div className="header-icon" onClick={() => setCurrentPage('orders')} style={{ cursor: 'pointer' }}>
              📦 Orders
            </div>
            <div className="header-icon">
              {user && (
                <div className="user-menu">
                  <button onClick={() => setCurrentPage('profile')} className="user-button">
                    👤 {user.name}
                  </button>
                  <button onClick={onLogout} className="logout-button">
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          <nav className="main-nav">
            <button
              className={`nav-link ${currentPage === 'products' ? 'active' : ''}`}
              onClick={() => setCurrentPage('products')}
            >
              Browse
            </button>
            <button
              className={`nav-link ${currentPage === 'cart' ? 'active' : ''}`}
              onClick={() => setCurrentPage('cart')}
            >
              Shopping Cart
            </button>
            <button
              className={`nav-link ${currentPage === 'upload' ? 'active' : ''}`}
              onClick={() => setCurrentPage('upload')}
            >
              Upload Product
            </button>
            <button
              className={`nav-link ${currentPage === 'orders' ? 'active' : ''}`}
              onClick={() => setCurrentPage('orders')}
            >
              My Orders
            </button>
          </nav>
        </div>
      </header>

      <main className="app-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
```

## Step 2: Update package.json (Client)

Ensure your client has the necessary dependencies:

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "axios": "^1.3.0"
  }
}
```

## Step 3: Install Dependencies

### Server
```bash
cd server
npm install
```

### Client
```bash
cd client
npm install
```

## Step 4: Set Environment Variables

### Server (.env)
```
PORT=5000
DB_SERVER=your-server-address
DB_NAME=your-database-name
DB_USER=your-user
DB_PASSWORD=your-password
DB_PORT=1433
JWT_SECRET=your-super-secret-jwt-key-change-this
CLIENT_URL=http://localhost:3000
```

### Client (.env)
```
REACT_APP_API_URL=http://localhost:5000/api
```

## Step 5: Initialize Database Roles

Before the first login, create the default roles in your database:

```sql
INSERT INTO RoleDetail (RoleName, RoleType, createdDate)
VALUES 
  ('Administrator', 'Admin', GETDATE()),
  ('Customer', 'Customer', GETDATE()),
  ('Seller', 'Seller', GETDATE());
```

## Step 6: Start the Application

### Terminal 1 - Server
```bash
cd server
npm run dev
```

### Terminal 2 - Client
```bash
cd client
npm start
```

## Step 7: Test the Authentication

1. Navigate to `http://localhost:3000/register`
2. Create a new account
3. Login with your credentials
4. View your profile and available features based on your role

## Adding Authentication to Existing Routes

### Protect All Routes
```javascript
import { ProtectedRoute } from './components/ProtectedRoute';

<Route
  path="/protected-route"
  element={
    <ProtectedRoute>
      <YourComponent />
    </ProtectedRoute>
  }
/>
```

### Protect Routes by Role
```javascript
import { RoleBasedRoute } from './components/ProtectedRoute';

<Route
  path="/admin"
  element={
    <RoleBasedRoute requiredRole="Admin">
      <AdminPanel />
    </RoleBasedRoute>
  }
/>
```

## Protecting API Routes on Server

### Example: Product creation limited to Sellers
```javascript
const { verifyToken, checkRole } = require('../middleware/auth');

router.post('/', verifyToken, checkRole(['Seller', 'Admin']), async (req, res) => {
  // Only sellers and admins can create products
  // req.user contains: userId, userName, name, roleType, roleId
});
```

## User Information in Components

Access the current user in any component:

```javascript
import { getUser, isAuthenticated, isAdmin } from '../utils/authUtils';

function MyComponent() {
  const user = getUser();

  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }

  return (
    <div>
      <p>Welcome, {user.name}!</p>
      <p>Your role: {user.roleType}</p>
      
      {isAdmin() && <p>You are an administrator</p>}
    </div>
  );
}
```

## Handling Authorization in API Calls

All API calls automatically include the authorization token:

```javascript
import { getProducts, createProduct } from './api';

// GET - works for everyone
const products = await getProducts();

// POST with auth - server middleware checks authorization
try {
  const newProduct = await createProduct(productData);
} catch (error) {
  if (error.response.status === 403) {
    console.log('You do not have permission to create products');
  }
}
```

## Common Issues and Solutions

### Issue: "Cannot GET /register"
**Solution**: Make sure you're using React Router and the route is defined in App.js

### Issue: Token not being sent
**Solution**: Check that the API client has the request interceptor that adds the Authorization header

### Issue: Getting 403 Forbidden
**Solution**: Check your user's role in the database and ensure it matches the required role

### Issue: Token invalid after server restart
**Solution**: This is expected behavior. Users will need to re-login after server restarts.

## Next Steps

1. Customize the Login and Register components to match your branding
2. Add role-specific UI elements based on user's role
3. Implement password reset functionality
4. Add two-factor authentication
5. Implement role-based API endpoints for your business logic
