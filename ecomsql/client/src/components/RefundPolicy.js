import React from 'react';
import { Link } from 'react-router-dom';
import './RefundPolicy.css';

const RefundPolicy = () => (
  <div className="refund-policy-page">
    <header className="refund-page-header">
      <div className="refund-header-inner">
        <Link to="/" className="refund-brand">✨ VSM - Sparkle Nest</Link>
        <Link to="/" className="refund-back-link">← Back to Shop</Link>
      </div>
    </header>
  <div className="refund-policy-container">
    <h1>Refund & Return Policy</h1>
    <p>
      Thank you for shopping with us! We take great pride in our curated collection of stationery and accessories. Please read our policy below regarding returns and refunds.
    </p>
    <h2>1. Return Window</h2>
    <p>
      Items can be returned or exchanged within <strong>2 days of delivery</strong>. To be eligible for a return, your item must be unused, in the same condition that you received it, and in its original packaging.
    </p>
    <h2>2. Non-Returnable Items</h2>
    <p>To maintain hygiene and quality standards, the following items cannot be returned:</p>
    <ul>
      <li><strong>Earrings and hair accessories</strong> (for hygiene reasons).</li>
      <li>Items on clearance or marked as "Final Sale."</li>
      <li>Personalized or custom-ordered products.</li>
    </ul>
    <h2>3. Damages and Issues</h2>
    <p>
      Please inspect your order upon reception. If the item is defective, damaged, or if you receive the wrong item, contact us immediately at sudhawins@gmail.com or +91 9894438549{' '}
      <a
        href="https://wa.me/919894438549"
        target="_blank"
        rel="noopener noreferrer"
        className="whatsapp-link"
        title="Chat on WhatsApp"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="whatsapp-icon" aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#25D366"/>
          <path fill="#fff" d="M23.5 8.5A10.44 10.44 0 0 0 16 5.5C10.2 5.5 5.5 10.2 5.5 16a10.42 10.42 0 0 0 1.4 5.2L5.5 26.5l5.4-1.4A10.46 10.46 0 0 0 16 26.5c5.8 0 10.5-4.7 10.5-10.5A10.44 10.44 0 0 0 23.5 8.5zm-7.5 16a8.65 8.65 0 0 1-4.4-1.2l-.3-.2-3.2.8.9-3.1-.2-.3A8.66 8.66 0 0 1 7.3 16c0-4.8 3.9-8.7 8.7-8.7S24.7 11.2 24.7 16s-3.9 8.5-8.7 8.5zm4.8-6.4c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.1-.7.9-.8 1.1-.3.2-.6 0a7.24 7.24 0 0 1-2.1-1.3 7.87 7.87 0 0 1-1.5-1.8c-.2-.3 0-.5.1-.6l.4-.5a1.72 1.72 0 0 0 .2-.4.44.44 0 0 0 0-.4c-.1-.1-.6-1.4-.8-1.9s-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.92 11.92 0 0 0 4.6 4c.6.3 1.1.4 1.5.3a2.76 2.76 0 0 0 1.8-1.3 2.23 2.23 0 0 0 .2-1.3c-.1-.2-.3-.3-.6-.4z"/>
        </svg>
        WhatsApp
      </a>{' '}
      so that we can evaluate the issue and make it right.
    </p>
    <p>
      <em>Note: We may require a short video of the unboxing to process damage claims.</em>
    </p>
    <h2>4. Refund Process</h2>
    <p>
      Once we receive and inspect your return, we will notify you of the approval or rejection of your refund.
    </p>
    <ul>
      <li><strong>Approved Refunds:</strong> The amount will be automatically refunded to your original payment method within 5–7 business days.</li>
      <li><strong>Shipping Costs:</strong> Please note that original shipping charges are non-refundable, and customers are responsible for return shipping costs unless the item arrived damaged.</li>
    </ul>
    <h2>5. Exchanges</h2>
    <p>
      The fastest way to ensure you get what you want is to return the item you have, and once the return is accepted, make a separate purchase for the new item.
    </p>
    </div>
</div>
);

export default RefundPolicy;
