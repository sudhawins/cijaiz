import React, { useState, useEffect } from 'react';
import { apiClient } from '../api';
import './HealthCheck.css';

const HealthCheck = () => {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('Checking server health...');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await apiClient.get('/health', {
          timeout: 5000
        });
        if (response.status === 200) {
          setStatus('healthy');
          setMessage('✓ Server is running');
        }
      } catch (error) {
        setStatus('unhealthy');
        setMessage('✗ Server connection failed');
        console.error('Health check failed:', error.message);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`health-check health-${status}`}>
      <span className="health-indicator"></span>
      <span className="health-message">{message}</span>
    </div>
  );
};

export default HealthCheck;
