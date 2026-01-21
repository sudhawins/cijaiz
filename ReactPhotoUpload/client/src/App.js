import React, { useState, useEffect } from 'react';
import './App.css';
import FileUpload from './components/FileUpload';
import FileList from './components/FileList';

function App() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/files');
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = (newFile) => {
    setFiles([newFile, ...files]);
  };

  return (
    <div className="App">
      <div className="container">
        <h1>📸 Photo & Video Upload</h1>
        <div className="content">
          <FileUpload onUploadSuccess={handleUploadSuccess} />
          <FileList files={files} loading={loading} onRefresh={fetchFiles} />
        </div>
      </div>
    </div>
  );
}

export default App;
