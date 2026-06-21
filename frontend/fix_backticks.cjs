const fs = require('fs');
let content = fs.readFileSync('c:/Users/ubend/Downloads/event-main/event-main/frontend/src/pages/ODCorrection.jsx', 'utf8');
content = content.replace(/\\`/g, '`');
fs.writeFileSync('c:/Users/ubend/Downloads/event-main/event-main/frontend/src/pages/ODCorrection.jsx', content);
console.log('Fixed backticks.');
