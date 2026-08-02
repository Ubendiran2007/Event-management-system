const http = require('http');

const data = JSON.stringify({
  email: 'priyanka@sece.ac.in',
  password: 'priyanka_sece_ac_in'
});

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let responseBody = '';
  res.on('data', (chunk) => {
    responseBody += chunk;
  });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${responseBody}`);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
