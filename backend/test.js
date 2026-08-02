const { getAllStaffDocs } = require('./utils/staffHelper');

async function run() {
  try {
    const docs = await getAllStaffDocs();
    console.log(JSON.stringify(docs, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
