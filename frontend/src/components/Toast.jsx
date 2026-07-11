import React, { useEffect, useRef } from 'react';

export default function Toast({ message, show, duration = 3000, onHide }) {
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (show) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        onHide?.();
      }, duration);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [show, duration, onHide]);

  return (
    <div
      className={`toast ${show ? 'show' : ''}`}
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        padding: '12px 24px',
        borderRadius: 'var(--radius-sm)',
        boxShadow: 'var(--shadow)',
        border: '1px solid var(--border)',
        fontSize: '0.85rem',
        zIndex: 200,
        display: show ? 'block' : 'none',
        animation: 'slideUp 0.3s ease',
      }}
    >
      {message}
    </div>
  );
}
