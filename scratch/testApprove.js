const { loginUser, createClient } = require('./load-tests/utils/api');

async function test() {
  const token = await loginUser('hod_cse@kce.ac.in', 'password');
  const client = createClient(token);
  
  try {
    const res = await client.patch('/events/load_test_event_2/registrations/student_test_123/status', {
      status: 'REGISTERED'
    });
    console.log('Success:', res.status, res.data);
  } catch (err) {
    if (err.response) {
      console.log('Error Response:', err.response.status, err.response.data);
    } else {
      console.log('Error:', err.message);
    }
  }
}
test();
