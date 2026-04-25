import React, { useState, useEffect, useCallback } from 'react';
import { getProductImages, uploadProductImage, deleteProductImage, API_BASE_URL } from '../api';
import './ProductImagesManagement.css';

const ProductImagesManagement = ({ product, onClose }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getProductImages(product.id);
      setImages(Array.isArray(response.data) ? response.data : []);
      setMessage('');
    } catch (err) {
      setMessage('Error loading images');
      console.error(err);
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [product.id]);

  useEffect(() => {
    loadImages();
  }, [product.id, loadImages]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
    setMessage('');
  };

  const handleUploadImage = async () => {
    if (!selectedFile) {
      setMessage('Please select an image');
      return;
    }

    try {
      setUploading(true);
      await uploadProductImage(product.id, selectedFile);
      setMessage('Image uploaded successfully');
      setSelectedFile(null);
      setPreviewUrl(null);
      setTimeout(() => {
        loadImages();
      }, 500);
    } catch (err) {
      setMessage('Error uploading image: ' + (err.response?.data?.error || err.message));
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    try {
      await deleteProductImage(imageId);
      setMessage('Image deleted successfully');
      loadImages();
    } catch (err) {
      setMessage('Error deleting image: ' + (err.response?.data?.error || err.message));
      console.error(err);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;
    if (API_BASE_URL) return `${API_BASE_URL}${imagePath}`;
    return imagePath;
  };

  if (loading) {
    return (
      <div className="pim-modal">
        <div className="pim-container">
          <div className="pim-header">
            <h2>Manage Images</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="loading-state">Loading images...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pim-modal">
      <div className="pim-container">
        <div className="pim-header">
          <h2>Manage Images - {product.name}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {message && (
          <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <div className="pim-content">
          {/* Upload Section */}
          <div className="upload-section">
            <h3>Upload New Image</h3>
            
            <div className="upload-area">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={uploading}
                id="image-input"
              />
              <label htmlFor="image-input" className="upload-label">
                <span>📷 Choose Image</span>
              </label>
            </div>

            {previewUrl && (
              <div className="preview-section">
                <h4>Preview</h4>
                <div className="preview-image">
                  <img src={previewUrl} alt="Preview" />
                </div>
                <div className="preview-actions">
                  <button
                    className="btn-upload"
                    onClick={handleUploadImage}
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : 'Upload Image'}
                  </button>
                  <button
                    className="btn-cancel"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                    disabled={uploading}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Images Grid */}
          <div className="images-section">
            <h3>Product Images ({images.length})</h3>
            
            {images.length === 0 ? (
              <div className="no-images">
                <p>No images uploaded yet. Upload your first image above!</p>
              </div>
            ) : (
              <div className="images-grid">
                {images.map((image, index) => (
                  <div key={image.id} className="image-card">
                    <div className="image-wrapper">
                      <img
                        src={getImageUrl(image.image_url)}
                        alt={`${index + 1}`}
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/150?text=Image+Not+Found';
                        }}
                      />
                      {image.is_primary && <div className="primary-badge">Primary</div>}
                    </div>
                    <div className="image-info">
                      <p className="img-order">Image #{index + 1}</p>
                      <button
                        className="btn-delete-img"
                        onClick={() => {
                          if (window.confirm('Delete this image?')) {
                            handleDeleteImage(image.id);
                          }
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductImagesManagement;
