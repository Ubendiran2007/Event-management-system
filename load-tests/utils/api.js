const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

async function loginUser(username, password) {
  try {
    const res = await axios.post(`${BASE_URL}/login`, { email: username, password });
    return res.data.token;
  } catch (err) {
    console.error(`Login failed for ${username}:`, err.response?.data || err.message);
    throw err;
  }
}

function createClient(token) {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 60000,
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true // Don't throw on 4xx/5xx for easy measurement
  });
}

module.exports = { loginUser, createClient, BASE_URL };
