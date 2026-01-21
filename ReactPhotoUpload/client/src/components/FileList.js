import React from 'react';
import './FileList.css';

function FileList({ files, loading, onRefresh }) {
  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return '🎬';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return '🖼️';
    return '📄';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDownload = (filename) => {
    window.open(`/api/download/${filename}`, '_blank');
  };

  const handleDelete = async (filename) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;

    try {
      const response = await fetch(`/api/delete/${filename}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        onRefresh();
      } else {
        alert('Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Error deleting file');
    }
  };

  return (
    <div className="file-list-container">
      <div className="file-list-header">
        <h2>Uploaded Files</h2>
        <button onClick={onRefresh} disabled={loading} className="refresh-button">
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading files...</div>
      ) : files.length === 0 ? (
        <div className="empty-state">
          <p>No files uploaded yet</p>
          <p className="empty-subtext">Upload your first file to get started</p>
        </div>
      ) : (
        <div className="files-grid">
          {files.map((file) => (
            <div key={file.id} className="file-card">
              <div className="file-icon">{getFileIcon(file.filename)}</div>
              <div className="file-info">
                <h3>{file.filename}</h3>
                <p className="file-size">{formatFileSize(file.size)}</p>
                <p className="file-date">{formatDate(file.uploadedAt)}</p>
              </div>
              <div className="file-actions">
                <button
                  onClick={() => handleDownload(file.filename)}
                  className="action-btn download-btn"
                  title="Download"
                >
                  ⬇️
                </button>
                <button
                  onClick={() => handleDelete(file.filename)}
                  className="action-btn delete-btn"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FileList;
