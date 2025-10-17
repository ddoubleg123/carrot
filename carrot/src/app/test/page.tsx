export default function TestPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🧪 Test Page</h1>
      <p>If you can see this, the server is working!</p>
      <p>Time: {new Date().toISOString()}</p>
      
      <h2>Test Image Generation</h2>
      <button 
        onClick={async () => {
          try {
            const response = await fetch('/api/test');
            const data = await response.json();
            alert('API Test: ' + JSON.stringify(data));
          } catch (error) {
            alert('API Error: ' + error);
          }
        }}
        style={{
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Test API
      </button>
    </div>
  );
}
