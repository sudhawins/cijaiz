import { useEffect } from 'react';
import './Notification.css';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationProps {
  message: string;
  type?: NotificationType;
  duration?: number; // Duration in milliseconds, null for persistent
  onClose?: () => void;
  icon?: string; // Optional custom icon/emoji
}

export default function Notification({
  message,
  type = 'info',
  duration = 4000,
  onClose,
  icon,
}: NotificationProps) {
  useEffect(() => {
    if (duration && duration > 0) {
      const timer = setTimeout(() => {
        onClose?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getIcon = () => {
    if (icon) return icon;
    
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  };

  return (
    <div className={`notification notification-${type}`}>
      <span className="notification-icon">{getIcon()}</span>
      <span className="notification-message">{message}</span>
      {onClose && (
        <button
          className="notification-close"
          onClick={onClose}
          aria-label="Close notification"
        >
          ✕
        </button>
      )}
    </div>
  );
}
