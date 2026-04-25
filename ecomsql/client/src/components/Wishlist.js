import React, { useEffect, useState } from 'react';
import { getWishlist, removeFromWishlist } from '../api';
import './Wishlist.css';

const Wishlist = () => {
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchWishlist = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getWishlist();
        setWishlist(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        setError('Failed to load wishlist');
      } finally {
        setLoading(false);
      }
    };
    fetchWishlist();
  }, []);

  const handleRemove = async (productId) => {
    try {
      await removeFromWishlist(productId);
      setWishlist(wishlist.filter(item => item.product_id !== productId));
    } catch {
      alert('Failed to remove from wishlist');
    }
  };

  if (loading) return <div className="wishlist-container">Loading wishlist...</div>;
  if (error) return <div className="wishlist-container error">{error}</div>;

  return (
    <div className="wishlist-container">
      <h1>My Wishlist</h1>
      {wishlist.length === 0 ? (
        <div className="empty-wishlist">Your wishlist is empty.</div>
      ) : (
        <div className="wishlist-grid">
          {wishlist.map(product => (
            <div className="wishlist-card" key={product.product_id}>
              <img
                src={product.image_url || 'https://via.placeholder.com/200?text=No+Image'}
                alt={product.name}
                className="wishlist-image"
              />
              <div className="wishlist-info">
                <h2>{product.name}</h2>
                <p className="wishlist-description">{product.description}</p>
                <div className="wishlist-meta">
                  <span className="wishlist-price">₹{product.price}</span>
                  <button className="remove-btn" onClick={() => handleRemove(product.product_id)}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
