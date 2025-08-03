'use client';

import React, { useRef, useEffect, useState } from 'react';

export default function CameraTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    // Get available devices when component mounts
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setDevices(devices.filter(device => device.kind === 'videoinput'));
      } catch (err) {
        console.error('Error getting devices:', err);
        setError('Failed to get camera devices');
      }
    };
    getDevices();
  }, []);

  useEffect(() => {
    if (!started || !videoRef.current) return;
    
    let stream: MediaStream | null = null;
    
    const startCamera = async () => {
      try {
        console.log('Starting camera...');
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          await videoRef.current.play();
          console.log('Camera started successfully');
        }
      } catch (err) {
        console.error('getUserMedia error:', err);
        setError(`Camera error: ${err instanceof Error ? err.message : String(err)}`);
        setStarted(false);
      }
    };
    
    startCamera();
    
    // Cleanup function
    return () => {
      if (stream) {
        console.log('Cleaning up stream');
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [started]);

  return (
    <div style={{ 
      padding: '2rem',
      maxWidth: '800px',
      margin: '0 auto',
      fontFamily: 'sans-serif'
    }}>
      <h1>Camera Test</h1>
      
      {error && (
        <div style={{ 
          background: '#ffebee', 
          color: '#c62828', 
          padding: '1rem',
          marginBottom: '1rem',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}
      
      <div style={{ marginBottom: '1rem' }}>
        <button 
          onClick={() => setStarted(!started)}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            backgroundColor: started ? '#f44336' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '1rem'
          }}
        >
          {started ? 'Stop Camera' : 'Start Camera'}
        </button>
        
        <div style={{ marginTop: '1rem' }}>
          <h3>Available Cameras:</h3>
          <ul>
            {devices.map((device, index) => (
              <li key={device.deviceId}>
                {device.label || `Camera ${index + 1}`}
                {device.deviceId === '' && ' (Permission needed)'}
              </li>
            ))}
            {devices.length === 0 && <li>No cameras found</li>}
          </ul>
        </div>
      </div>
      
      <div style={{
        width: '100%',
        height: '450px',
        backgroundColor: started ? 'transparent' : '#f5f5f5',
        border: '2px dashed #ccc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {started ? (
          <video
            ref={videoRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)' // Mirror the video
            }}
            autoPlay
            muted
            playsInline
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#666' }}>
            <p>Camera is off</p>
          </div>
        )}
      </div>
      
      <div style={{ marginTop: '2rem' }}>
        <h3>Debug Info:</h3>
        <pre style={{
          background: '#f5f5f5',
          padding: '1rem',
          borderRadius: '4px',
          overflowX: 'auto'
        }}>
          {JSON.stringify({
            started,
            hasVideoElement: !!videoRef.current,
            hasStream: started && videoRef.current?.srcObject !== null,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'navigator not available',
            isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
            devices: devices.map(d => ({
              deviceId: d.deviceId ? `${d.deviceId.substring(0, 10)}...` : 'none',
              label: d.label || 'No label',
              kind: d.kind
            }))
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
