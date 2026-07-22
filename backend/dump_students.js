const { getAllSectionDocs } = require('./utils/studentHelper');
const fs = require('fs');

async function dumpStudents() {
  try {
    const docs = await getAllSectionDocs();
    const students = docs.map(d => ({
      id: d.sec, // document ID
      batch: d.batch,
      dept: d.dept,
      ...d.data
    }));
    fs.writeFileSync('../students_dump.json', JSON.stringify(students, null, 2));
    console.log(`Successfully dumped ${students.length} students to students_dump.json`);
    process.exit(0);
  } catch(e) {
    console.error('Error dumping students:', e);
    process.exit(1);
  }
}

dumpStudents();
