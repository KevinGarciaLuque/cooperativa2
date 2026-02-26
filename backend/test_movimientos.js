const http = require('http');

async function probarMovimientos() {
  return new Promise((resolve, reject) => {
    console.log('🧪 Probando endpoint GET /api/movimientos...\n');
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/movimientos',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZF91c3VhcmlvIjoyLCJyb2xfaWQiOjEsIm5vbWJyZV9jb21wbGV0byI6IkFkbWluaXN0cmFkb3IiLCJyb2wiOiJBZG1pbmlzdHJhZG9yIiwiZG5pIjoiMDAwMDAwMDAiLCJpYXQiOjE3NDA0NTY2MTksImV4cCI6MTc0MDQ4NTQxOX0.IQdBX8C9YfHiUqvFBirTgLXwTCONl5-Wh9zZgUGEzf0'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('✅ Respuesta recibida!');
        console.log('Status:', res.statusCode);
        try {
          const jsonData = JSON.parse(data);
          console.log('Data:', JSON.stringify(jsonData, null, 2));
        } catch (e) {
          console.log('Raw Data:', data);
        }
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ ERROR!');
      console.error('Error:', error.message);
      reject(error);
    });
    
    req.end();
  });
}

probarMovimientos().catch(console.error);
