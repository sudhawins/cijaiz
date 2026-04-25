import { useState, useEffect } from 'react';
import '../styles/RollingBanner.css';

interface BannerImage {
  name: string;
  url: string;
}

const RollingBanner: React.FC = () => {
  const [images, setImages] = useState<BannerImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch banner images from the backend
  useEffect(() => {
    const fetchBannerImages = async () => {
      try {
        setIsLoading(true);
        const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
        
        // Define banner images with correct API paths
        const bannerImages: BannerImage[] = [
          { name: 'Mansion front view', url: `${apiBaseUrl}/banner/Mansionfrontview.png` },
          { name: '4 Cot', url: `${apiBaseUrl}/banner/4cot.png` },
          { name: 'Double Cot', url: `${apiBaseUrl}/banner/doublecot.png` },
          { name: 'Single Cot', url: `${apiBaseUrl}/banner/singlecot.png` }
        ];

        setImages(bannerImages);
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('Error setting up banner images:', errorMsg);
        setError(errorMsg);
        setImages([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBannerImages();
  }, []);

  // Auto-rotate images every 5 seconds
  useEffect(() => {
    if (images.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [images.length]);

  // Handle previous button
  const goToPrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  // Handle next button
  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  // Handle dot click
  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  if (isLoading) {
    return (
      <div className="rolling-banner">
        <div className="banner-placeholder">
          <p>Loading banner images...</p>
        </div>
      </div>
    );
  }

  if (error || images.length === 0) {
    return (
      <div className="rolling-banner">
        <div className="banner-placeholder error">
          <p>{error || 'No banner images found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rolling-banner">
      <div className="banner-container">
        <div className="banner-slider">
          {images.map((image, index) => (
            <div
              key={index}
              className={`banner-slide ${index === currentIndex ? 'active' : ''}`}
              style={{
                backgroundImage: `url(${image.url})`,
                opacity: index === currentIndex ? 1 : 0,
                visibility: index === currentIndex ? 'visible' : 'hidden'
              }}
            >
              <div className="banner-label">{image.name}</div>
            </div>
          ))}
        </div>

        {/* Navigation buttons */}
        <button
          className="banner-btn banner-btn-prev"
          onClick={goToPrevious}
          aria-label="Previous slide"
        >
          ❮
        </button>
        <button
          className="banner-btn banner-btn-next"
          onClick={goToNext}
          aria-label="Next slide"
        >
          ❯
        </button>

        {/* Dots indicator */}
        <div className="banner-dots">
          {images.map((_, index) => (
            <button
              key={index}
              className={`dot ${index === currentIndex ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Image counter */}
      <div className="banner-counter">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
};

export default RollingBanner;
