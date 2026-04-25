import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser, loginUser } from '../api';
import './Register.css';

function Register() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // Email validation regex
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!name.trim()) {
      setError('Name is required');
      return false;
    }
    if (!phoneNumber.trim()) {
      setError('Phone number is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      // Register user with email (always as Customer)
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPhone = phoneNumber.trim();

      await registerUser(
        normalizedEmail, 
        normalizedPhone,
        name, 
        normalizedPhone,
        shippingAddress.trim() || null
      );
      
      setSuccess('Registration successful! Logging you in with phone number...');
      
      // Auto-login after successful registration
      setTimeout(async () => {
        try {
          const response = await loginUser(normalizedEmail, normalizedPhone);
          localStorage.setItem('authToken', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          localStorage.setItem('userPassword', normalizedPhone);
          window.dispatchEvent(new Event('auth-changed'));
          navigate('/');
        } catch (loginError) {
          console.error('Auto-login failed:', loginError);
          // Redirect to login page even if auto-login fails
          setTimeout(() => navigate('/login'), 1500);
        }
      }, 1000);
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.errors?.[0]?.msg ||
                          'Registration failed. Please try again.';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleLoginClick = () => {
    navigate('/login');
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h1>Create Account</h1>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name:</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              placeholder="Enter your full name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              placeholder="Enter your email address"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phoneNumber">Phone Number:</label>
            <input
              type="tel"
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              disabled={loading}
              placeholder="Enter your phone number"
            />
          </div>

          <p style={{ margin: '0 0 12px 0', color: '#666', fontSize: '14px' }}>
            Your phone number will be used as your password.
          </p>

          <div className="form-group">
            <label htmlFor="shippingAddress">Shipping Address (Optional):</label>
            <textarea
              id="shippingAddress"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              disabled={loading}
              placeholder="Enter your shipping address"
              rows="3"
              style={{ resize: 'none' }}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="register-button"
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <div className="register-footer">
          <p>Already have an account? 
            <button 
              onClick={handleLoginClick}
              className="login-link"
            >
              Login here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
