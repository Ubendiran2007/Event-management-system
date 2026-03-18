const { runEventAutoRejectionOnce } = require('./services/eventAutoRejectionService');

async function test() {
  const result = await runEventAutoRejectionOnce();
  console.log('Result:', result);
}
test().then(() => process.exit(0)).catch(console.error);
