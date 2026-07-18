const fs = require('fs');
const img = fs.readFileSync('e:/Event-management-system/frontend/src/assets/sece header.jpeg');
const b64 = img.toString('base64');
fs.writeFileSync('e:/Event-management-system/frontend/src/assets/seceHeaderBase64.js', 'export const seceHeaderBase64 = "data:image/jpeg;base64,' + b64 + '";\n');
console.log('Done');
