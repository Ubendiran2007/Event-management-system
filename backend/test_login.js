fetch('http://localhost:5001/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'thamilselvan.p2024cse@sece.ac.in', password: '24CS251' })
}).then(res => res.json()).then(console.log).catch(console.error);
