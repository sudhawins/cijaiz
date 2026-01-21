import React, { useState } from 'react';
import './FileUpload.css';

function FileUpload({ onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'];
      const maxSize = 100 * 1024 * 1024; // 100MB

      if (!validTypes.includes(file.type)) {
        setError('Please select a valid image or video file');
        return;
      }

      if (file.size > maxSize) {
        setError('File size should be less than 100MB');
        return;
      }

      setSelectedFile(file);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setUploading(true);
      setProgress(0);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          onUploadSuccess(response.file);
          setSelectedFile(null);
          setProgress(0);
          setError('');
          document.querySelector('input[type="file"]').value = '';
        }
      });

      xhr.addEventListener('error', () => {
        setError('Upload failed. Please try again.');
      });

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    } catch (err) {
      setError('Error uploading file: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-container">
      <h2>Upload Files</h2>
      <div className="upload-box">
        <div className="upload-icon">📁</div>
        <p className="upload-text">Select photos or videos to upload</p>
        <input
          type="file"
          onChange={handleFileSelect}
          disabled={uploading}
          accept="image/*,video/*"
          className="file-input"
        />
        <label className="file-label">Choose File</label>

        {selectedFile && (
          <div className="selected-file">
            <p>Selected: {selectedFile.name}</p>
            <p className="file-size">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</p>
          </div>
        )}

        {progress > 0 && progress < 100 && (
          <div className="progress-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="progress-text">{Math.round(progress)}%</p>
          </div>
        )}

        {error && <p className="error-message">{error}</p>}

        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="upload-button"
        >
          {uploading ? `Uploading... ${Math.round(progress)}%` : 'Upload'}
        </button>
      </div>
    </div>
  );
}

export default FileUpload;
