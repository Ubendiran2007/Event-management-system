const fs = require('fs');
const execSync = require('child_process').execSync;

const filesOutput = execSync('dir /s /b frontend\\src\\*.jsx frontend\\src\\*.js', {encoding: 'utf8'});
const files = filesOutput.split('\r\n').filter(Boolean);

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  let init = c;
  
  // Update the fallback from localhost to the production URL
  c = c.replace(/import\.meta\.env\.VITE_BACKEND_URL\s*\|\|\s*'http:\/\/localhost:5001'/g, "import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'");
  c = c.replace(/import\.meta\.env\.VITE_BACKEND_URL\s*\|\|\s*"http:\/\/localhost:5001"/g, 'import.meta.env.VITE_BACKEND_URL || "https://event-management-system-dpzc.onrender.com"');
  
  if (c !== init) {
    fs.writeFileSync(f, c);
    console.log('Updated fallback in', f);
  }
});
