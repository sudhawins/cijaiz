import React, { useState, useEffect, useCallback } from 'react';
import { getProductImages, deleteProductImage, API_BASE_URL } from '../api';
import { hasAnyRole } from '../utils/authUtils';
import './ViewPhotos.css';

const ViewPhotos = ({ productId, productName, onClose }) => {
  const [images, setImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const canDeleteImages = hasAnyRole(['Seller', 'Administrator']);

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getProductImages(productId);
      const imageList = Array.isArray(response.data) ? response.data : [];
      setImages(imageList);
      if (imageList.length > 0) {
        setSelectedImageIndex(0);
      }
    } catch (err) {
      setError('Failed to load images');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadImages();
  }, [productId, loadImages]);

  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return 'https://via.placeholder.com/400?text=No+Image';
    if (imageUrl.startsWith('http')) return imageUrl;
    if (API_BASE_URL) return `${API_BASE_URL}${imageUrl}`;
    return imageUrl;
  };

  const handleDeleteImage = async (imageId, event) => {
    event.stopPropagation();

    if (!canDeleteImages) {
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      setDeleteInProgress(true);
      await deleteProductImage(imageId);
      
      const newImages = images.filter(img => img.id !== imageId);
      setImages(newImages);
      
      if (newImages.length === 0) {
        setSelectedImageIndex(-1);
      } else if (selectedImageIndex >= newImages.length) {
        setSelectedImageIndex(newImages.length - 1);
      }
    } catch (err) {
      alert('Failed to delete image: ' + err.message);
    } finally {
      setDeleteInProgress(false);
    }
  };

  const handlePrevImage = () => {
    setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const selectedImage = images[selectedImageIndex];

  return (
    <div className="view-photos-modal-overlay" onClick={onClose}>
      <div className="view-photos-modal" onClick={(e) => e.stopPropagation()}>
        <div className="photos-header">
          <h2>Photos - {productName}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading images...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="no-images">
            <p>No images available for this product</p>
          </div>
        ) : (
          <div className="photos-container">
            {/* Main Image Display */}
            <div className="main-image-section">
              <div className="main-image-wrapper">
                <img
                  src={getImageUrl(selectedImage.image_url)}
                  alt={`${productName} ${selectedImageIndex + 1}`}
                  className="main-image"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/400?text=No+Image';
                  }}
                />
                {selectedImage.is_primary && (
                  <div className="primary-badge">Primary Image</div>
                )}
              </div>
              
              {images.length > 1 && (
                <div className="main-image-controls">
                  <button 
                    className="nav-btn prev-btn" 
                    onClick={handlePrevImage}
                    title="Previous image"
                  >
                    ❮
                  </button>
                  <span className="image-counter">
                    {selectedImageIndex + 1} / {images.length}
                  </span>
                  <button 
                    className="nav-btn next-btn" 
                    onClick={handleNextImage}
                    title="Next image"
                  >
                    ❯
                  </button>
                </div>
              )}

              <div className="image-info">
                <p>Uploaded: {new Date(selectedImage.uploaded_at).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Thumbnails Section */}
            {images.length > 1 && (
              <div className="thumbnails-section">
                <h3>All Photos ({images.length})</h3>
                <div className="thumbnails-grid">
                  {images.map((image, index) => (
                    <div
                      key={image.id}
                      className={`thumbnail-item ${
                        selectedImageIndex === index ? 'active' : ''
                      } ${image.is_primary ? 'primary' : ''}`}
                      onClick={() => setSelectedImageIndex(index)}
                      title={image.is_primary ? 'Primary image' : 'Click to view'}
                    >
                      <img
                        src={getImageUrl(image.image_url)}
                        alt={`Thumbnail ${index + 1}`}
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/80?text=No+Image';
                        }}
                      />
                      {image.is_primary && (
                        <span className="primary-indicator">★</span>
                      )}
                      {canDeleteImages && (
                        <button
                          className="delete-thumbnail-btn"
                          onClick={(e) => handleDeleteImage(image.id, e)}
                          disabled={deleteInProgress}
                          title="Delete this image"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Single Image Delete for 1 image */}
            {images.length === 1 && canDeleteImages && (
              <div className="single-image-controls">
                <button
                  className="delete-btn"
                  onClick={(e) => handleDeleteImage(selectedImage.id, e)}
                  disabled={deleteInProgress}
                >
                  {deleteInProgress ? 'Deleting...' : 'Delete Image'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewPhotos;
