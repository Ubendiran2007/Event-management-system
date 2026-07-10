const fs = require('fs');
const path = require('path');

const filesToFix = [
  'routes/events.js',
  'routes/iqac.js',
  'routes/odRequests.js'
];

filesToFix.forEach(relativePath => {
  const filePath = path.join(__dirname, relativePath);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace `setImmediate(async () => {` with `await (async () => {`
  // We will do a character-by-character scan to find the matching `});`
  
  let index = 0;
  while ((index = content.indexOf('setImmediate(async () => {', index)) !== -1) {
    // Find the opening brace of the arrow function
    const startBraceIndex = content.indexOf('{', index);
    
    let braceCount = 1;
    let i = startBraceIndex + 1;
    
    while (i < content.length && braceCount > 0) {
      if (content[i] === '{') braceCount++;
      else if (content[i] === '}') braceCount--;
      i++;
    }
    
    // i is now just after the closing brace `}`
    // The next characters should be `);`
    if (content.slice(i, i + 2) === ');') {
      // We found the exact block.
      // Replace `setImmediate(async () => {` with `await (async () => {`
      const prefix = content.slice(0, index);
      const replacementStart = 'await (async () => {';
      const innerContent = content.slice(startBraceIndex + 1, i - 1);
      const replacementEnd = '}();';
      const suffix = content.slice(i + 2);
      
      content = prefix + replacementStart + innerContent + replacementEnd + suffix;
    } else {
      // Move index forward if something was weird
      index++;
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed', relativePath);
});
