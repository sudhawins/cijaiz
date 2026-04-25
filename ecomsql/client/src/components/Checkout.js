import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode.react';
import { createOrder, getAllCities, getLocationFromIP, calculateShippingForItems, registerUser, loginUser } from '../api';
import { getUser } from '../utils/authUtils';
import './Checkout.css';

const Checkout = ({ 
  cartItems, 
  subtotalAmount = 0, 
  gstAmount = 0, 
  shippingCharge = 0, 
  totalAmount, 
  appliedDiscount = null,
  appliedRewards = null,
  onClose, 
  onOrderComplete 
}) => {
  const sessionId = localStorage.getItem('sessionId');
  const [step, setStep] = useState('details'); // 'details' -> 'payment' -> 'confirmation'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('gpay');
  const [qrValue, setQrValue] = useState('');
  const [orderId, setOrderId] = useState('');
  
  // Dropdown states
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [zipDropdownOpen, setZipDropdownOpen] = useState(false);
  const [filteredCities, setFilteredCities] = useState([]);
  const [filteredZipCodes, setFilteredZipCodes] = useState([]);
  const cityDropdownRef = useRef(null);
  const zipDropdownRef = useRef(null);
  
  // Shipping data states
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(true);

  const [orderSummaryCollapsed, setOrderSummaryCollapsed] = useState(true);

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    shippingAddress: '',
    city: '',
    zipCode: ''
  });

  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  
  // State for calculated shipping charge
  const [calculatedShippingCharge, setCalculatedShippingCharge] = useState(shippingCharge);

  // Shipping & Geolocation states
  const [shippingData, setShippingData] = useState({
    charge: shippingCharge || 0,
    zone: 'unknown',
    city: '',
    pincode: '',
    baseShippingCharge: null,
    totalWeightKg: null,
    chargeableWeightKg: null,
    estimatedDistanceKm: null
  });
  const [locationLoading, setLocationLoading] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [shippingLoading, setShippingLoading] = useState(false);
  
  // Shipping breakdown states for payment screen
  const [shippingBreakdown, setShippingBreakdown] = useState(null);
  const [showShippingDetailsInPayment, setShowShippingDetailsInPayment] = useState(false);
  const [showShippingDetailsInInfo, setShowShippingDetailsInInfo] = useState(false);

  // Fetch shipping rates when city changes
  const fetchShippingRates = useCallback(async (city) => {
    if (!city || !Array.isArray(cartItems) || cartItems.length === 0) return;
    
    try {
      setShippingLoading(true);
      console.log('[Checkout] Fetching shipping rates for city:', city);
      
      const response = await calculateShippingForItems(
        city,
        cartItems.map(item => ({
          productId: item.product_id,
          quantity: item.quantity
        }))
      );
      
      if (response.data.success) {
        console.log('[Checkout] Shipping rates received:', response.data);
        setCalculatedShippingCharge(response.data.shippingCharge || 0);
        setShippingData(prev => ({
          ...prev,
          charge: response.data.shippingCharge,
          zone: response.data.zone,
          city: response.data.city,
          baseShippingCharge: response.data.baseShippingCharge ?? null,
          totalWeightKg: response.data.totalWeightKg ?? null,
          chargeableWeightKg: response.data.chargeableWeightKg ?? null,
          estimatedDistanceKm: response.data.estimatedDistanceKm ?? null
        }));
      }
    } catch (error) {
      console.warn('[Checkout] Failed to fetch shipping rates:', error.message);
      // Fallback to zero when shipping cannot be determined.
      setCalculatedShippingCharge(0);
      setShippingData(prev => ({
        ...prev,
        charge: 0,
        baseShippingCharge: null,
        totalWeightKg: null,
        chargeableWeightKg: null,
        estimatedDistanceKm: null
      }));
    } finally {
      setShippingLoading(false);
    }
  }, [cartItems]);

  // Generate UPI/GPay QR code
  useEffect(() => {
    if (step === 'payment' && selectedPayment === 'gpay') {
      const calculatedTotal = subtotalAmount + gstAmount + calculatedShippingCharge;
      const upiString = `upi://pay?pa=cijai4u@okicici&pn=VSM-SparkleNest&am=${calculatedTotal}&tn=SparkleNest-shop - ${formData.customerName}`;
      setQrValue(upiString);
    }
  }, [step, selectedPayment, subtotalAmount, gstAmount, calculatedShippingCharge, formData.customerName]);

  // Fetch shipping breakdown when entering payment step
  useEffect(() => {
    if (step === 'payment' && formData.city && cartItems.length > 0) {
      const fetchShippingBreakdown = async () => {
        try {
          const response = await calculateShippingForItems(formData.city, cartItems);
          setShippingBreakdown(response.data || null);
        } catch (error) {
          console.error('[Checkout] Error fetching shipping breakdown:', error);
          setShippingBreakdown(null);
        }
      };
      fetchShippingBreakdown();
    }
  }, [step, formData.city, cartItems]);

  // Load cities from API on component mount
  useEffect(() => {
    const loadCitiesData = async () => {
      try {
        setCitiesLoading(true);
        const response = await getAllCities();
        const citiesArray = response.data || [];
        setCities(citiesArray);
        setFilteredCities(citiesArray);
        setFilteredZipCodes(citiesArray);
        console.log('[Checkout] Cities loaded from database:', citiesArray);
      } catch (error) {
        console.error('[Checkout] Error loading cities:', error);
        setMessage('Failed to load cities from database');
        setCities([]);
        setFilteredCities([]);
        setFilteredZipCodes([]);
      } finally {
        setCitiesLoading(false);
      }
    };
    
    loadCitiesData();
  }, []);

  // Pre-fill form data if user is logged in
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const loggedInUser = getUser();
    if (loggedInUser && loggedInUser.name) {
      setFormData(prev => ({
        ...prev,
        customerName: loggedInUser.name,
        customerEmail: loggedInUser.userName || '' // Using userName as email
      }));
    }
  }, []);

  // Fetch location from IP and populate city/zipcode
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const fetchLocationFromIP = async () => {
      try {
        setLocationLoading(true);
        console.log('[Checkout] Fetching location from IP...');
        const response = await getLocationFromIP();
        
        if (response.data.success) {
          console.log('[Checkout] Location detected:', response.data);
          setFormData(prev => ({
            ...prev,
            city: response.data.city || prev.city,
            zipCode: response.data.pincode || prev.zipCode
          }));
          setShippingData(prev => ({
            ...prev,
            city: response.data.city,
            pincode: response.data.pincode
          }));
          
          // Fetch shipping rates for detected city
          if (response.data.city) {
            await fetchShippingRates(response.data.city);
          }
        }
      } catch (error) {
        console.warn('[Checkout] Failed to fetch location from IP:', error.message);
        // Fallback - set default city to Mumbai
        setFormData(prev => ({
          ...prev,
          city: 'Mumbai',
          zipCode: '400001'
        }));
      } finally {
        setLocationLoading(false);
      }
    };

    fetchLocationFromIP();
  }, [fetchShippingRates]);

  // Validate email address
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate phone number (Indian format)
  const validatePhoneNumber = (phone) => {
    // Remove spaces, hyphens, and country code
    const cleaned = phone.replace(/[\s\-+]/g, '').replace(/^91/, '');
    
    // Check if it has exactly 10 digits
    if (!/^\d{10}$/.test(cleaned)) {
      return false;
    }
    
    // Check if first digit is 6, 7, 8, or 9 (valid Indian mobile numbers)
    if (!/^[6-9]/.test(cleaned)) {
      return false;
    }
    
    return true;
  };

  // Handle city search and filter
  const handleCitySearch = (value) => {
    setFormData(prev => ({
      ...prev,
      city: value
    }));
    setCityDropdownOpen(true);
    
    const filtered = cities.filter(item =>
      item.city_name?.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredCities(filtered);
  };

  // Calculate shipping based on selected city using API zone data
  const calculateShipping = async (city) => {
    if (!city || !Array.isArray(cartItems) || cartItems.length === 0) {
      console.warn('[Checkout] Cannot calculate shipping - missing city or cart items');
      return null;
    }

    try {
      const response = await calculateShippingForItems(
        city,
        cartItems.map(item => ({
          productId: item.product_id,
          quantity: item.quantity
        }))
      );

      if (response.data?.success) {
        const charge = response.data.shippingCharge || 0;
        setCalculatedShippingCharge(charge);
        setShippingData(prev => ({
          ...prev,
          charge,
          zone: response.data.zone,
          city: response.data.city,
          baseShippingCharge: response.data.baseShippingCharge ?? null,
          totalWeightKg: response.data.totalWeightKg ?? null,
          chargeableWeightKg: response.data.chargeableWeightKg ?? null,
          estimatedDistanceKm: response.data.estimatedDistanceKm ?? null
        }));
        return charge;
      }
    } catch (error) {
      console.warn('[Checkout] Shipping calculation failed:', error.message);
    }

    setCalculatedShippingCharge(0);
    setShippingData(prev => ({
      ...prev,
      charge: 0,
      baseShippingCharge: null,
      totalWeightKg: null,
      chargeableWeightKg: null,
      estimatedDistanceKm: null
    }));
    return null;
  };

  // Handle city selection
  const handleCitySelect = (cityData) => {
    const cityName = cityData.city_name || cityData.city;
    const zipCode = cityData.zip_code || cityData.zipCode;
    setFormData(prev => ({
      ...prev,
      city: cityName,
      zipCode: zipCode
    }));
    setShowShippingDetailsInInfo(false);
    setShowShippingDetailsInInfo(false);
    setCityDropdownOpen(false);
    // Calculate shipping when city is selected
    calculateShipping(cityName);
  };

  // Handle zip code search and filter
  const handleZipSearch = (value) => {
    setFormData(prev => ({
      ...prev,
      zipCode: value
    }));
    setZipDropdownOpen(true);
    
    const filtered = cities.filter(item =>
      item.zip_code?.includes(value) || 
      item.city_name?.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredZipCodes(filtered);
  };

  // Handle zip code selection
  const handleZipSelect = (cityData) => {
    const cityName = cityData.city_name || cityData.city;
    const zipCode = cityData.zip_code || cityData.zipCode;
    setFormData(prev => ({
      ...prev,
      city: cityName,
      zipCode: zipCode
    }));
    setZipDropdownOpen(false);
    // Calculate shipping when city is selected via zip code
    calculateShipping(cityName);
  };

  // Handle payment screenshot upload
  const handleScreenshotUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setMessage('Please upload an image file');
        return;
      }
      
      // Validate file size (max 1MB)
      if (file.size > 1 * 1024 * 1024) {
        setMessage('File size must be less than 1MB');
        return;
      }

      setPaymentScreenshot(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result);
      };
      reader.readAsDataURL(file);
      setMessage('');
    }
  };

  // Remove screenshot
  const handleRemoveScreenshot = () => {
    setPaymentScreenshot(null);
    setScreenshotPreview(null);
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target)) {
        setCityDropdownOpen(false);
      }
      if (zipDropdownRef.current && !zipDropdownRef.current.contains(event.target)) {
        setZipDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const persistCheckoutAuth = (token, user) => {
    if (!token || !user) {
      return;
    }

    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(user));
    window.dispatchEvent(new Event('auth-changed'));
  };

  const validateDetails = () => {
    if (!formData.customerName.trim()) {
      setMessage('Please enter your name');
      return false;
    }
    if (!formData.customerEmail.trim()) {
      setMessage('Please enter your email');
      return false;
    }
    
    // Validate email format
    if (!validateEmail(formData.customerEmail)) {
      setMessage('Please enter a valid email address');
      return false;
    }
    
    // Validate phone number
    if (!formData.customerPhone.trim()) {
      setMessage('Please enter your phone number');
      return false;
    }
    
    if (!validatePhoneNumber(formData.customerPhone)) {
      setMessage('Please enter a valid 10-digit phone number (starting with 6-9)');
      return false;
    }
    
    if (!formData.shippingAddress.trim()) {
      setMessage('Please enter your address');
      return false;
    }
    if (!formData.city.trim()) {
      setMessage('Please enter your city');
      return false;
    }
    if (!formData.zipCode.trim()) {
      setMessage('Please enter your zip code');
      return false;
    }
    return true;
  };

  const handleContinueToPayment = async () => {
    setMessage('');
    
    // First validate basic details
    if (!validateDetails()) {
      return;
    }

    // Check if city is validly selected from the dropdown
    const selectedCity = cities.find(c => 
      (c.city_name || c.city)?.toLowerCase() === formData.city?.toLowerCase()
    );
    
    if (!selectedCity) {
      setMessage('Invalid city selected. Please choose a valid city from the dropdown.');
      return;
    }

    // Recalculate shipping rates for the selected city
    const shippingCharge = await calculateShipping(formData.city);
    
    // Validate that shipping charges were calculated successfully
    if (shippingCharge === null || shippingCharge === undefined) {
      setMessage('Unable to calculate shipping charges. Please select a valid city with proper shipping information.');
      return;
    }

    if (shippingCharge < 0) {
      setMessage('Invalid shipping charge calculated. Please check your city selection and try again.');
      return;
    }

    // Auto-login or register guest user before proceeding to payment
    if (!getUser()) {
      setLoading(true);
      try {
        const email = formData.customerEmail.trim().toLowerCase();
        const phone = formData.customerPhone.trim();
        const address = `${formData.shippingAddress}, ${formData.city} - ${formData.zipCode}`;

        try {
          // Try to login with email + phone number as password
          const loginResp = await loginUser(email, phone);
          persistCheckoutAuth(loginResp.data.token, loginResp.data.user);
        } catch (loginErr) {
          if (loginErr.response?.status === 401 || loginErr.response?.status === 404) {
            // Not found or wrong credentials — try to register as new customer
            try {
              await registerUser(email, phone, formData.customerName.trim(), phone, address);
              // Registration succeeded — now login to get token
              const loginResp = await loginUser(email, phone);
              persistCheckoutAuth(loginResp.data.token, loginResp.data.user);
            } catch (regErr) {
              // 409: email exists but different phone/password — proceed as guest
              // Any other error — proceed as guest silently
              console.warn('[Checkout] Auto-register/login skipped:', regErr.response?.data?.error || regErr.message);
            }
          } else {
            console.warn('[Checkout] Auto-login skipped:', loginErr.message);
          }
        }
      } finally {
        setLoading(false);
      }
    }

    // All validations passed, proceed to payment
    setStep('payment');
  };

  const handlePaymentSubmit = async () => {
    setLoading(true);
    setMessage('');
    try {
      // Convert screenshot to base64
      let paymentScreenshotBase64 = null;
      if (paymentScreenshot) {
        paymentScreenshotBase64 = screenshotPreview; // Already in base64 format from FileReader
      }

      // Normalize email for consistency
      const normalizedEmail = formData.customerEmail.trim().toLowerCase();

      // Calculate discount amounts (applies ONLY to product value, never to GST)
      const discountAmount = (appliedDiscount?.amount || 0) + (appliedRewards?.discountAmount || 0);

      const latestShippingCharge = await calculateShipping(formData.city);
      if (latestShippingCharge === null || latestShippingCharge === undefined) {
        setMessage('Unable to calculate shipping charges. Please verify your city and try again.');
        setLoading(false);
        return;
      }
      
      // GST MUST NEVER be discounted - always charged on original product value
      // GST is independent of any coupons or loyalty point redemptions
      const gstForOrder = 0;
      
      // Calculate total: (subtotal - discount) + original GST + shipping
      // GST is never reduced under any circumstances
      const subtotalAfterDiscount = Math.max(0, subtotalAmount - discountAmount);
      const calculatedTotal = subtotalAfterDiscount + gstForOrder + latestShippingCharge;

      // Create order
      const response = await createOrder({
        sessionId,
        customerName: formData.customerName,
        customerEmail: normalizedEmail,
        customerPhone: formData.customerPhone.trim(),
        shippingCity: formData.city,
        shippingAddress: `${formData.shippingAddress}, ${formData.city} - ${formData.zipCode}`,
        items: cartItems.map(item => ({
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          price: item.price
        })),
        subtotalAmount,
        gstAmount: 0,
        shippingCharge: latestShippingCharge,
        totalAmount: calculatedTotal,
        paymentMethod: selectedPayment,
        paymentScreenshot: paymentScreenshotBase64,
        orderDate: new Date().toISOString(),
        appliedDiscount: appliedDiscount || null,
        appliedRewards: appliedRewards || null
      });

      if (response.data?.checkoutAuth?.token && response.data?.checkoutAuth?.user) {
        persistCheckoutAuth(response.data.checkoutAuth.token, response.data.checkoutAuth.user);
      }

      setOrderId(response.data?.id || response.data?.orderId || 'ORD-' + Date.now());
      setStep('confirmation');
      
      // Call completion callback after showing confirmation
      setTimeout(() => {
        // Call order complete callback first
        if (onOrderComplete) {
          onOrderComplete();
        }
        onClose && onClose();
      }, 3000);
    } catch (err) {
      setMessage('Error processing order: ' + (err.response?.data?.error || err.message));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadQRCode = () => {
    const qrCanvas = document.querySelector('canvas');
    const url = qrCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `payment-qr-${Date.now()}.png`;
    link.click();
  };

  // Step 1: Customer Details
  if (step === 'details') {
    return (
      <div className="checkout-modal">
        <div className="checkout-container">
          <div className="checkout-header">
            <h2>Shipping Information</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>

          <div className="checkout-content">
            <div className="order-summary-sidebar">
              <div className="order-summary-header">
                <div className="order-summary-title-group">
                  <h3>Order Summary</h3>
                  {orderSummaryCollapsed && (
                    <span className="order-summary-collapsed-total">
                      {cartItems.length} item{cartItems.length !== 1 ? 's' : ''} &bull; ₹{(() => {
                        const discountAmount = (appliedDiscount?.amount || 0) + (appliedRewards?.discountAmount || 0);
                        const subtotalAfterDiscount = Math.max(0, subtotalAmount - discountAmount);
                        return (subtotalAfterDiscount + gstAmount + calculatedShippingCharge).toFixed(2);
                      })()}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="order-summary-toggle-btn"
                  onClick={() => setOrderSummaryCollapsed(prev => !prev)}
                  aria-expanded={!orderSummaryCollapsed}
                  aria-label={orderSummaryCollapsed ? 'Expand order summary' : 'Collapse order summary'}
                >
                  <span className={`toggle-chevron${orderSummaryCollapsed ? ' collapsed' : ''}`}>▲</span>
                </button>
              </div>
              <div className={`order-summary-body${orderSummaryCollapsed ? ' collapsed' : ''}`}>
                <div className="order-items">
                  {cartItems.map(item => (
                    <div key={item.id} className="order-item">
                      <div className="item-details">
                        <p className="item-name">{item.product_name}</p>
                        <span className="item-qty">Qty: {item.quantity}</span>
                      </div>
                      <span className="item-price">₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="order-total">
                  <div className="total-breakdown">
                    <div className="breakdown-row">
                      <span>Subtotal:</span>
                      <span>₹{subtotalAmount.toFixed(2)}</span>
                    </div>
                    <div className="breakdown-row">
                      <span>GST (0%):</span>
                      <span>₹{gstAmount.toFixed(2)}</span>
                    </div>
                    <div className="breakdown-row">
                      <span>Shipping:</span>
                      <span>{calculatedShippingCharge === 0 ? <span style={{ color: '#28a745' }}>Free</span> : <span style={{ color: '#FFC107' }}>₹{calculatedShippingCharge.toFixed(2)}</span>}</span>
                    </div>

                    {/* Applied Discounts in Summary Table - Always show divider if any discount exists */}
                    {(appliedDiscount || appliedRewards) && (
                      <div className="breakdown-divider"></div>
                    )}

                    {/* Coupon Discount */}
                    {appliedDiscount && (
                      <div className="breakdown-row discount-breakdown-row">
                        <span style={{ color: '#FF6B6B', fontWeight: '600' }}>Coupon ({appliedDiscount.code}):</span>
                        <span style={{ color: '#FF6B6B', fontWeight: '600' }}>-₹{appliedDiscount.amount.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Loyalty Points Discount */}
                    {appliedRewards && appliedRewards.points > 0 && (
                      <div className="breakdown-row discount-breakdown-row">
                        <span style={{ color: '#FFC107', fontWeight: '600' }}>Loyalty Points ({appliedRewards.points}):</span>
                        <span style={{ color: '#FFC107', fontWeight: '600' }}>-₹{appliedRewards.discountAmount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="breakdown-divider"></div>
                    <div className="breakdown-row total-row">
                      <h4>Total Amount</h4>
                      <p className="total-price">₹{(() => {
                        const discountAmount = (appliedDiscount?.amount || 0) + (appliedRewards?.discountAmount || 0);
                        const subtotalAfterDiscount = Math.max(0, subtotalAmount - discountAmount);
                        // GST is calculated on ORIGINAL subtotal and never discounted
                        return (subtotalAfterDiscount + gstAmount + calculatedShippingCharge).toFixed(2);
                      })()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <form className="checkout-form">
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    name="customerEmail"
                    value={formData.customerEmail}
                    onChange={handleInputChange}
                    placeholder="Enter your email"
                    className={`email-input ${
                      formData.customerEmail && !validateEmail(formData.customerEmail)
                        ? 'invalid'
                        : formData.customerEmail && validateEmail(formData.customerEmail)
                        ? 'valid'
                        : ''
                    }`}
                    required
                  />
                  {formData.customerEmail && !validateEmail(formData.customerEmail) && (
                    <span className="field-error">Invalid email address (e.g., name@example.com)</span>
                  )}
                  {formData.customerEmail && validateEmail(formData.customerEmail) && (
                    <span className="field-success">✓ Valid email</span>
                  )}
                </div>
                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="tel"
                    name="customerPhone"
                    value={formData.customerPhone}
                    onChange={handleInputChange}
                    placeholder="Enter your 10-digit phone number (e.g., 9876543210)"
                    className={`phone-input ${
                      formData.customerPhone && !validatePhoneNumber(formData.customerPhone)
                        ? 'invalid'
                        : formData.customerPhone && validatePhoneNumber(formData.customerPhone)
                        ? 'valid'
                        : ''
                    }`}
                    required
                  />
                  {formData.customerPhone && !validatePhoneNumber(formData.customerPhone) && (
                    <span className="field-error">Invalid phone number (must be 10 digits, starting with 6-9)</span>
                  )}
                  {formData.customerPhone && validatePhoneNumber(formData.customerPhone) && (
                    <span className="field-success">✓ Valid phone number</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Shipping Address *</label>
                <textarea
                  name="shippingAddress"
                  value={formData.shippingAddress}
                  onChange={handleInputChange}
                  placeholder="Enter your complete address"
                  rows="3"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    City * 
                    {locationLoading && <span style={{ fontSize: '12px', marginLeft: '8px', color: '#666' }}>Detecting location...</span>}
                    {!locationLoading && shippingData.zone !== 'unknown' && (
                      <span style={{ fontSize: '12px', marginLeft: '8px', color: '#28a745' }}>
                        ✓ {shippingData.zone.toUpperCase()} ZONE - Shipping: ₹{shippingData.charge.toFixed(2)}
                      </span>
                    )}
                  </label>
                  <div className="searchable-dropdown" ref={cityDropdownRef}>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleCitySearch(e.target.value)}
                      onFocus={() => setCityDropdownOpen(true)}
                      placeholder="Search and select city"
                      className="dropdown-input"
                      disabled={citiesLoading}
                      required
                    />
                    {citiesLoading && <div className="loading-message">Loading cities...</div>}
                    {cityDropdownOpen && filteredCities.length > 0 && (
                      <div className="dropdown-menu">
                        {filteredCities.map((item, index) => (
                          <div
                            key={index}
                            className="dropdown-item"
                            onClick={() => handleCitySelect(item)}
                          >
                            <span className="city-name">{item.city_name || item.city}</span>
                            <span className="zip-hint">{item.zip_code || item.zipCode}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {cityDropdownOpen && filteredCities.length === 0 && formData.city && (
                      <div className="dropdown-menu">
                        <div className="dropdown-item-empty">No cities found</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label>Zip Code *</label>
                  <div className="searchable-dropdown" ref={zipDropdownRef}>
                    <input
                      type="text"
                      value={formData.zipCode}
                      onChange={(e) => handleZipSearch(e.target.value)}
                      onFocus={() => setZipDropdownOpen(true)}
                      placeholder="Search and select zip code"
                      className="dropdown-input"
                      disabled={citiesLoading}
                      required
                    />
                    {zipDropdownOpen && filteredZipCodes.length > 0 && (
                      <div className="dropdown-menu">
                        {filteredZipCodes.map((item, index) => (
                          <div
                            key={index}
                            className="dropdown-item"
                            onClick={() => handleZipSelect(item)}
                          >
                            <span className="zip-code">{item.zip_code || item.zipCode}</span>
                            <span className="city-hint">{item.city_name || item.city}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {zipDropdownOpen && filteredZipCodes.length === 0 && formData.zipCode && (
                      <div className="dropdown-menu">
                        <div className="dropdown-item-empty">No zip codes found</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Shipping Cost Display */}
              {formData.city && (
                <div className="shipping-cost-display">
                  <div className="shipping-cost-info">
                    <span className="shipping-label">🚚 Shipping Cost for {formData.city}:</span>
                    <span className="shipping-cost">₹{calculatedShippingCharge}</span>
                  </div>
                  <button
                    type="button"
                    className="shipping-breakdown-toggle"
                    onClick={() => setShowShippingDetailsInInfo(prev => !prev)}
                    aria-expanded={showShippingDetailsInInfo}
                  >
                    <span>Shipping charge details</span>
                    <span className={`shipping-breakdown-chevron${showShippingDetailsInInfo ? ' expanded' : ''}`}>▼</span>
                  </button>
                  {showShippingDetailsInInfo && (
                    <div className="shipping-breakdown-panel">
                      <div className="shipping-breakdown-row">
                        <span>Zone:</span>
                        <span>{shippingData.zone && shippingData.zone !== 'unknown' ? shippingData.zone.toUpperCase() : 'N/A'}</span>
                      </div>
                      <div className="shipping-breakdown-row">
                        <span>Base Charge per 100g:</span>
                        <span>{shippingData.baseShippingCharge !== null ? `₹${(Number(shippingData.baseShippingCharge) / 10).toFixed(2)}` : 'N/A'}</span>
                      </div>
                      <div className="shipping-breakdown-row">
                        <span>Total Weight:</span>
                        <span>{shippingData.totalWeightKg !== null ? `${Number(shippingData.totalWeightKg).toFixed(2)} kg` : 'N/A'}</span>
                      </div>
                      <div className="shipping-breakdown-row">
                        <span>Chargeable Weight:</span>
                        <span>{shippingData.chargeableWeightKg !== null ? `${shippingData.chargeableWeightKg} kg` : 'N/A'}</span>
                      </div>
                      <div className="shipping-breakdown-row">
                        <span>Estimated Distance:</span>
                        <span>{shippingData.estimatedDistanceKm !== null ? `${shippingData.estimatedDistanceKm} km` : 'N/A'}</span>
                      </div>
                    </div>
                  )}
                  <p className="shipping-note">Shipping charge is calculated based on your delivery location</p>
                </div>
              )}

              {message && <div className="error-message">{message}</div>}

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleContinueToPayment}
                >
                  Continue to Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Payment Method
  if (step === 'payment') {
    return (
      <div className="checkout-modal">
        <div className="checkout-container">
          <div className="checkout-header">
            <h2>Payment Method</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>

          <div className="checkout-content payment-step">
            <div className="payment-options">
              <h3>Select Payment Method</h3>
              
              <div className="payment-method-group">
                <label className={`payment-option ${selectedPayment === 'gpay' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    value="gpay"
                    checked={selectedPayment === 'gpay'}
                    onChange={(e) => setSelectedPayment(e.target.value)}
                  />
                  <span className="payment-icon">🏦</span>
                  <span className="payment-text">Google Pay / UPI</span>
                </label>

                <label className={`payment-option ${selectedPayment === 'card' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    value="card"
                    checked={selectedPayment === 'card'}
                    onChange={(e) => setSelectedPayment(e.target.value)}
                  />
                  <span className="payment-icon">💳</span>
                  <span className="payment-text">Credit / Debit Card</span>
                </label>

                <label className={`payment-option ${selectedPayment === 'upi' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    value="upi"
                    checked={selectedPayment === 'upi'}
                    onChange={(e) => setSelectedPayment(e.target.value)}
                  />
                  <span className="payment-icon">📱</span>
                  <span className="payment-text">UPI Direct</span>
                </label>
              </div>
            </div>

            <div className="qr-code-section">
              {selectedPayment === 'gpay' && qrValue && (
                <div className="qr-container">
                  <h3>Scan to Pay</h3>
                  <p className="qr-note">Scan the QR code with your phone to complete payment</p>
                  <div className="qr-code-box">
                    <QRCode
                      value={qrValue}
                      size={256}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={downloadQRCode}
                  >
                    Download QR Code
                  </button>
                </div>
              )}

              {selectedPayment === 'card' && (
                <div className="card-section">
                  <p className="payment-note">Card payments are being processed securely.</p>
                  <p className="payment-info">
                    Your payment information is encrypted and secure.
                  </p>
                </div>
              )}

              {selectedPayment === 'upi' && (
                <div className="upi-section">
                  <p className="payment-note">Open your UPI app and complete the payment.</p>
                  <p className="payment-info">
                    You'll receive a confirmation once payment is received.
                  </p>
                </div>
              )}
            </div>

            <div className="payment-summary">
              <h4>Order Summary</h4>
              <div className="payment-summary-breakdown">
                <div className="summary-line">
                  <span>Subtotal:</span>
                  <span>₹{subtotalAmount.toFixed(2)}</span>
                </div>
                <div className="summary-line">
                  <span>GST (0%):</span>
                  <span>₹{gstAmount.toFixed(2)}</span>
                </div>
                
                {/* Collapsible Shipping Details */}
                <div className="summary-line shipping-header-line">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setShowShippingDetailsInPayment(!showShippingDetailsInPayment)}>
                    <span>Shipping:</span>
                    {shippingBreakdown && <span className={`shipping-expand-icon ${showShippingDetailsInPayment ? 'expanded' : ''}`}>▼</span>}
                  </div>
                  <span>{calculatedShippingCharge === 0 ? 'Free' : `₹${calculatedShippingCharge.toFixed(2)}`}</span>
                </div>
                
                {/* Shipping Details Breakdown */}
                {shippingBreakdown && showShippingDetailsInPayment && (
                  <div className="shipping-details-breakdown-payment">
                    <div className="shipping-detail-item">
                      <span className="detail-label">City:</span>
                      <span className="detail-value">{shippingBreakdown.city || 'N/A'}</span>
                    </div>
                    <div className="shipping-detail-item">
                      <span className="detail-label">Zone:</span>
                      <span className="detail-value">{shippingBreakdown.zone || 'N/A'}</span>
                    </div>
                    <div className="shipping-detail-item">
                      <span className="detail-label">Base Rate per 100g:</span>
                      <span className="detail-value">₹{(Number(shippingBreakdown.baseShippingCharge || 0) / 10).toFixed(2)}</span>
                    </div>
                    <div className="shipping-detail-item">
                      <span className="detail-label">Total Weight:</span>
                      <span className="detail-value">{Number(shippingBreakdown.totalWeightKg || 0).toFixed(2)} kg</span>
                    </div>
                    <div className="shipping-detail-item">
                      <span className="detail-label">Chargeable Weight:</span>
                      <span className="detail-value">{shippingBreakdown.chargeableWeightKg} kg</span>
                    </div>
                  </div>
                )}
                
                {(appliedDiscount || appliedRewards) && (
                  <>
                    <div className="summary-divider"></div>
                    {appliedDiscount && (
                      <div className="summary-line discount">
                        <span style={{ color: '#FF6B6B' }}>Coupon ({appliedDiscount.code}):</span>
                        <span style={{ color: '#FF6B6B' }}>-₹{appliedDiscount.amount.toFixed(2)}</span>
                      </div>
                    )}
                    {appliedRewards && appliedRewards.points > 0 && (
                      <div className="summary-line discount">
                        <span style={{ color: '#FFC107' }}>Loyalty Points ({appliedRewards.points}):</span>
                        <span style={{ color: '#FFC107' }}>-₹{appliedRewards.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="summary-divider"></div>
                <div className="summary-total">
                  <strong>Total:</strong>
                  <strong style={{ fontSize: '18px', color: '#FF9900' }}>₹{(() => {
                    const discountAmount = (appliedDiscount?.amount || 0) + (appliedRewards?.discountAmount || 0);
                    const subtotalAfterDiscount = Math.max(0, subtotalAmount - discountAmount);
                    return (subtotalAfterDiscount + gstAmount + calculatedShippingCharge).toFixed(2);
                  })()}</strong>
                </div>
              </div>
            </div>

            {/* Payment Screenshot Upload */}
            <div className="screenshot-upload-section">
              <h4>Upload Payment Screenshot</h4>
              <p className="screenshot-note">Please upload a screenshot of your payment confirmation</p>
              
              {!screenshotPreview ? (
                <div className="file-upload-wrapper">
                  <label htmlFor="payment-screenshot" className="file-upload-label">
                    <div className="file-upload-area">
                      <span className="upload-icon">📷</span>
                      <p className="upload-text">Click to upload screenshot</p>
                      <p className="upload-hint">PNG, JPG, up to 5MB</p>
                    </div>
                    <input
                      id="payment-screenshot"
                      type="file"
                      accept="image/*"
                      onChange={handleScreenshotUpload}
                      className="file-input"
                    />
                  </label>
                </div>
              ) : (
                <div className="screenshot-preview-wrapper">
                  <div className="screenshot-preview">
                    <img src={screenshotPreview} alt="Payment screenshot" />
                    <button
                      type="button"
                      className="remove-screenshot-btn"
                      onClick={handleRemoveScreenshot}
                    >
                      ✕
                    </button>
                  </div>
                  <p className="screenshot-uploaded">✓ Screenshot uploaded successfully</p>
                </div>
              )}
            </div>

            {message && <div className="error-message">{message}</div>}

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep('details')}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handlePaymentSubmit}
                disabled={loading || !paymentScreenshot}
              >
                {loading ? 'Processing...' : `Complete Payment`}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Confirmation
  if (step === 'confirmation') {
    return (
      <div className="checkout-modal">
        <div className="checkout-container checkout-confirmation">
          <div className="confirmation-content">
            <div className="success-icon">✓</div>
            <h2>Order Confirmed!</h2>
            <p className="order-number">Order ID: {orderId}</p>
            <p className="confirmation-message">
              Your order has been placed successfully. You will receive a confirmation email shortly.
            </p>
            <div className="confirmation-details">
              <p><strong>Subtotal:</strong> ₹{subtotalAmount.toFixed(2)}</p>
              {(appliedDiscount || appliedRewards) && (
                <>
                  {appliedDiscount && (
                    <p><strong>Coupon Discount:</strong> -₹{appliedDiscount.amount.toFixed(2)}</p>
                  )}
                  {appliedRewards && appliedRewards.points > 0 && (
                    <p><strong>Loyalty Discount:</strong> -₹{appliedRewards.discountAmount.toFixed(2)}</p>
                  )}
                </>
              )}
              <p><strong>GST (18%):</strong> ₹{gstAmount.toFixed(2)}</p>
              <p><strong>Shipping:</strong> {calculatedShippingCharge === 0 ? 'Free' : `₹${calculatedShippingCharge.toFixed(2)}`}</p>
              <p style={{ borderTop: '1px solid #ddd', paddingTop: '10px', marginTop: '10px', fontSize: '16px' }}>
                <strong>Total Paid:</strong> <strong style={{ color: '#FF9900' }}>₹{(() => {
                  const discountAmount = (appliedDiscount?.amount || 0) + (appliedRewards?.discountAmount || 0);
                  const subtotalAfterDiscount = Math.max(0, subtotalAmount - discountAmount);
                  return (subtotalAfterDiscount + gstAmount + calculatedShippingCharge).toFixed(2);
                })()}</strong>
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onClose && onClose()}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }
};

export default Checkout;
