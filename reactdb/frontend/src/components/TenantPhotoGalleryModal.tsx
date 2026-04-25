import React from 'react';
import { TenantWithOccupancy } from './TenantManagement';
import { getFileUrl } from '../api';

interface TenantPhotoGalleryModalProps {
  tenant: TenantWithOccupancy;
  onClose: () => void;
  initialPhotoIndex: number | null;
  initialProofIndex: number | null;
  initialTab: 'photos' | 'proofs';
}

export default function TenantPhotoGalleryModal({
  tenant,
  onClose,
  initialPhotoIndex,
  initialProofIndex,
  initialTab,
}: TenantPhotoGalleryModalProps) {
  const [photoIndex, setPhotoIndex] = React.useState(initialPhotoIndex);
  const [proofIndex, setProofIndex] = React.useState(initialProofIndex);
  const [mediaTab, setMediaTab] = React.useState<'photos' | 'proofs'>(initialTab);
  const [zoom, setZoom] = React.useState(100);

  const getTenantPhotos = (tenant: TenantWithOccupancy): string[] => {
    return [
      tenant.photoUrl,
      tenant.photo2Url,
      tenant.photo3Url,
      tenant.photo4Url,
      tenant.photo5Url,
      tenant.photo6Url,
      tenant.photo7Url,
      tenant.photo8Url,
      tenant.photo9Url,
      tenant.photo10Url,
    ].filter((url): url is string => !!url);
  };

  const getTenantProofs = (tenant: TenantWithOccupancy): string[] => {
    return [
      tenant.proof1Url,
      tenant.proof2Url,
      tenant.proof3Url,
      tenant.proof4Url,
      tenant.proof5Url,
      tenant.proof6Url,
      tenant.proof7Url,
      tenant.proof8Url,
      tenant.proof9Url,
      tenant.proof10Url,
    ].filter((url): url is string => !!url);
  };

  const photos = getTenantPhotos(tenant);
  const proofs = getTenantProofs(tenant);
  const hasPhotos = photos.length > 0;
  const hasProofs = proofs.length > 0;

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        if (mediaTab === 'photos' && photoIndex !== null) {
          setPhotoIndex((photoIndex - 1 + photos.length) % photos.length);
        } else if (mediaTab === 'proofs' && proofIndex !== null) {
          setProofIndex((proofIndex - 1 + proofs.length) % proofs.length);
        }
      } else if (e.key === 'ArrowRight') {
        if (mediaTab === 'photos' && photoIndex !== null) {
          setPhotoIndex((photoIndex + 1) % photos.length);
        } else if (mediaTab === 'proofs' && proofIndex !== null) {
          setProofIndex((proofIndex + 1) % proofs.length);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photoIndex, proofIndex, mediaTab, onClose, photos.length, proofs.length]);

  if (!hasPhotos && !hasProofs) return null;

  return (
    <div className="fullscreen-overlay" onClick={onClose}>
      <div className="fullscreen-modal" onClick={(e) => e.stopPropagation()}>
        {/* Professional Header */}
        <div className="gallery-header">
          <div className="gallery-header-content">
            <div>
              <h2 className="gallery-tenant-name">{tenant.name || 'Tenant'}</h2>
              <p className="gallery-header-subtitle">
                {mediaTab === 'photos' ? `📸 Photo Gallery (${photos.length} photos)` : `📄 Document Proofs (${proofs.length} documents)`}
              </p>
            </div>
            <button
              className="gallery-close-btn"
              onClick={onClose}
              title="Close (ESC)"
              aria-label="Close gallery"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Media Type Tabs */}
          {hasPhotos && hasProofs && (
            <div className="gallery-tabs">
              <button
                className={`gallery-tab ${mediaTab === 'photos' ? 'active' : ''}`}
                onClick={() => {
                  setMediaTab('photos');
                  if (photoIndex === null) setPhotoIndex(0);
                }}
              >
                <span className="tab-icon">📸</span>
                <span className="tab-text">Photos ({photos.length})</span>
              </button>
              <button
                className={`gallery-tab ${mediaTab === 'proofs' ? 'active' : ''}`}
                onClick={() => {
                  setMediaTab('proofs');
                  if (proofIndex === null) setProofIndex(0);
                }}
              >
                <span className="tab-icon">📄</span>
                <span className="tab-text">Proofs ({proofs.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* Photos View */}
        {mediaTab === 'photos' && photoIndex !== null && (
          <>
            <div className="gallery-main-container">
              {(() => {
                const currentPhoto = photos[photoIndex];
                return (
                  <>
                    <img
                      src={getFileUrl(currentPhoto)}
                      alt={`Photo ${photoIndex + 1}`}
                      className="gallery-main-image"
                      style={{ transform: `scale(${zoom / 100})` }}
                      loading="lazy"
                    />
                    <div className="gallery-counter">
                      {photoIndex + 1} / {photos.length}
                    </div>
                    
                    {/* Zoom Controls */}
                    <div className="gallery-zoom-controls">
                      <button
                        className="zoom-btn"
                        onClick={() => setZoom(Math.max(50, zoom - 10))}
                        title="Zoom Out"
                      >
                        −
                      </button>
                      <span className="zoom-value">{zoom}%</span>
                      <button
                        className="zoom-btn"
                        onClick={() => setZoom(Math.min(200, zoom + 10))}
                        title="Zoom In"
                      >
                        +
                      </button>
                      <button
                        className="zoom-btn"
                        onClick={() => setZoom(100)}
                        title="Reset Zoom"
                      >
                        Reset
                      </button>
                    </div>

                    {/* Navigation Arrows */}
                    {photos.length > 1 && (
                      <>
                        <button
                          className="gallery-nav-btn gallery-nav-prev"
                          onClick={() => setPhotoIndex((photoIndex - 1 + photos.length) % photos.length)}
                          title="Previous (← or Swipe)"
                        >
                          ‹
                        </button>
                        <button
                          className="gallery-nav-btn gallery-nav-next"
                          onClick={() => setPhotoIndex((photoIndex + 1) % photos.length)}
                          title="Next (→ or Swipe)"
                        >
                          ›
                        </button>
                      </>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Thumbnail Gallery */}
            {photos.length > 1 && (
              <div className="gallery-thumbnails">
                <div className="thumbnails-scroll">
                  {photos.map((photo, idx) => (
                    <div
                      key={idx}
                      className={`gallery-thumbnail ${idx === photoIndex ? 'active' : ''}`}
                      onClick={() => {
                        setPhotoIndex(idx);
                        setZoom(100);
                      }}
                      title={`Photo ${idx + 1}`}
                    >
                      <img
                        src={getFileUrl(photo)}
                        alt={`Thumbnail ${idx + 1}`}
                      />
                      <span className="thumbnail-number">{idx + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Proofs View */}
        {mediaTab === 'proofs' && proofIndex !== null && (
          <>
            <div className="gallery-main-container">
              {(() => {
                const currentProof = proofs[proofIndex];
                return (
                  <>
                    <img
                      src={getFileUrl(currentProof)}
                      alt={`Proof ${proofIndex + 1}`}
                      className="gallery-main-image"
                      style={{ transform: `scale(${zoom / 100})` }}
                      loading="lazy"
                    />
                    <div className="gallery-counter">
                      {proofIndex + 1} / {proofs.length}
                    </div>

                    {/* Zoom Controls */}
                    <div className="gallery-zoom-controls">
                      <button
                        className="zoom-btn"
                        onClick={() => setZoom(Math.max(50, zoom - 10))}
                        title="Zoom Out"
                      >
                        −
                      </button>
                      <span className="zoom-value">{zoom}%</span>
                      <button
                        className="zoom-btn"
                        onClick={() => setZoom(Math.min(200, zoom + 10))}
                        title="Zoom In"
                      >
                        +
                      </button>
                      <button
                        className="zoom-btn"
                        onClick={() => setZoom(100)}
                        title="Reset Zoom"
                      >
                        Reset
                      </button>
                    </div>

                    {/* Navigation Arrows */}
                    {proofs.length > 1 && (
                      <>
                        <button
                          className="gallery-nav-btn gallery-nav-prev"
                          onClick={() => setProofIndex((proofIndex - 1 + proofs.length) % proofs.length)}
                          title="Previous (← or Swipe)"
                        >
                          ‹
                        </button>
                        <button
                          className="gallery-nav-btn gallery-nav-next"
                          onClick={() => setProofIndex((proofIndex + 1) % proofs.length)}
                          title="Next (→ or Swipe)"
                        >
                          ›
                        </button>
                      </>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Thumbnail Gallery */}
            {proofs.length > 1 && (
              <div className="gallery-thumbnails">
                <div className="thumbnails-scroll">
                  {proofs.map((proof, idx) => (
                    <div
                      key={idx}
                      className={`gallery-thumbnail ${idx === proofIndex ? 'active' : ''}`}
                      onClick={() => {
                        setProofIndex(idx);
                        setZoom(100);
                      }}
                      title={`Proof ${idx + 1}`}
                    >
                      <img
                        src={getFileUrl(proof)}
                        alt={`Thumbnail ${idx + 1}`}
                      />
                      <span className="thumbnail-number">{idx + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

