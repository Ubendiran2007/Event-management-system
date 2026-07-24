const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:5001/api/login', {
      email: 'stu1_cse@kce.ac.in',
      password: 'password'
    });
    console.log('Success:', res.data);
  } catch (err) {
    console.error('Error:', err.response?.status, err.response?.data || err.message);
  }
}
test();
