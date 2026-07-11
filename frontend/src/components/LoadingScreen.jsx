import React from 'react';

export default function LoadingScreen({ hidden }) {
  return (
    <div
      id="loading-screen"
      className={hidden ? 'hidden' : ''}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        transition: 'opacity 0.4s ease',
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
      }}
    >
      <div className="spinner"></div>
      <div className="loading-text">Loading Study Gap Detector...</div>
    </div>
  );
}
