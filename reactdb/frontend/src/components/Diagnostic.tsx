import { useState, useEffect } from 'react';
import { apiService } from '../api';

export default function Diagnostic() {
  const [schema, setSchema] = useState<any[]>([]);
  const [sample, setSample] = useState<any[]>([]);
  const [backendStatus, setBackendStatus] = useState<string>('loading');
  const [dbStatus, setDbStatus] = useState<string>('loading');
  const [tables, setTables] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [schemaRes, sampleRes, _healthRes, _dbRes, tablesRes] = await Promise.all([
          apiService.getRentalSchema(),
          apiService.getRentalSample(),
          apiService.getHealth(),
          apiService.getDatabaseStatus(),
          apiService.getTables()
        ]);
        setSchema(schemaRes.data);
        setSample(sampleRes.data);
        setBackendStatus('connected');
        setDbStatus('connected');
        setTables(tablesRes.data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error fetching diagnostic data';
        setError(msg);
        setBackendStatus('error');
        setDbStatus('error');
        console.error('Diagnostic error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ 
        position: 'fixed', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)', 
        background: 'white', 
        padding: '3rem', 
        borderRadius: '12px', 
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)', 
        zIndex: 10000, 
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        width: 'min(92vw, 420px)',
        maxHeight: '85vh',
        overflowY: 'auto'
      }}>
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
          <circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="rgba(102, 126, 234, 0.2)"
            strokeWidth="4"
          />
          <circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="#667eea"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="96 60"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 28 28"
              to="360 28 28"
              dur="0.9s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
        <p style={{ 
          color: '#4a5568', 
          fontSize: '1.1rem', 
          fontWeight: 500, 
          margin: 0 
        }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <h2 className="section-heading">Diagnostic</h2>

      {error && (
        <div style={{ 
          background: '#f8d7da', 
          color: '#721c24', 
          padding: '15px', 
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ marginBottom: '30px' }}>
        <h2>System Status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
          <div style={{ 
            background: '#f9f9f9', 
            padding: '15px', 
            borderRadius: '8px',
            border: `3px solid ${backendStatus === 'connected' ? '#28a745' : '#dc3545'}`
          }}>
            <strong>Backend Status:</strong>
            <span style={{ 
              marginLeft: '10px',
              padding: '4px 8px',
              background: backendStatus === 'connected' ? '#d4edda' : '#f8d7da',
              color: backendStatus === 'connected' ? '#155724' : '#721c24',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}>
              {backendStatus.toUpperCase()}
            </span>
          </div>
          <div style={{ 
            background: '#f9f9f9', 
            padding: '15px', 
            borderRadius: '8px',
            border: `3px solid ${dbStatus === 'connected' ? '#28a745' : '#dc3545'}`
          }}>
            <strong>Database Status:</strong>
            <span style={{ 
              marginLeft: '10px',
              padding: '4px 8px',
              background: dbStatus === 'connected' ? '#d4edda' : '#f8d7da',
              color: dbStatus === 'connected' ? '#155724' : '#721c24',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}>
              {dbStatus.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {tables.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h2>Database Tables</h2>
          <div style={{ 
            background: '#f9f9f9', 
            padding: '15px',
            borderRadius: '8px',
            overflowX: 'auto'
          }}>
            <ul style={{ 
              margin: 0,
              paddingLeft: '20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '10px'
            }}>
              {tables.map((table: any, idx: number) => (
                <li key={idx} style={{ padding: '8px', background: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
                  {table.TABLE_NAME}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '30px' }}>
        <h2>RentalCollection Table Schema</h2>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ 
            width: '100%',
            minWidth: '560px',
            borderCollapse: 'collapse',
            background: 'white',
            border: '1px solid #ddd'
          }}>
            <thead style={{ background: '#f0f0f0' }}>
              <tr>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Column Name</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Data Type</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Nullable</th>
              </tr>
            </thead>
            <tbody>
              {schema.map((col: any, idx: number) => (
                <tr key={idx}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}><strong>{col.COLUMN_NAME}</strong></td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{col.DATA_TYPE}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{col.IS_NULLABLE}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2>Sample Data (Top 5 records)</h2>
        {sample.length > 0 ? (
          <div style={{ 
            background: '#f9f9f9', 
            padding: '15px',
            borderRadius: '8px',
            overflowX: 'auto'
          }}>
            <pre style={{ margin: 0 }}>
              {JSON.stringify(sample, null, 2)}
            </pre>
          </div>
        ) : (
          <p>No sample data available</p>
        )}
      </div>
    </div>
  );
}
