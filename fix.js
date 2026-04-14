const fs=require('fs'); 
const path=require('path'); 
function fixBase(dir) { 
  const files=fs.readdirSync(dir); 
  for(const f of files) { 
    const p=path.join(dir,f); 
    if(fs.statSync(p).isDirectory()) { 
      fixBase(p); 
    } else if(p.endsWith('.tsx') || p.endsWith('.ts')) { 
      let content=fs.readFileSync(p, 'utf8'); 
      content=content.replace(/\\\\\`/g, '\`'); 
      fs.writeFileSync(p, content); 
    } 
  } 
} 
fixBase('./app'); 
fixBase('./src');
