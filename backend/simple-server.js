// Simple test server without dependencies
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });

  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }

  if (req.url === '/health') {
    res.end(JSON.stringify({
      status: 'healthy',
      message: 'HospedeFácil Backend is running!',
      timestamp: new Date().toISOString()
    }));
  } else if (req.url === '/api/test') {
    res.end(JSON.stringify({
      success: true,
      message: 'API is working!',
      platform: 'HospedeFácil'
    }));
  } else {
    res.end(JSON.stringify({
      message: 'HospedeFácil Backend API',
      endpoints: ['/health', '/api/test'],
      version: '1.0.0'
    }));
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 HospedeFácil Backend running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
});