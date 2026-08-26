const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./app').concat(walk('./components'));
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  content = content.replace(/#001e40/g, '#1e293b'); // completely map any leftover 001e40
  content = content.replace(/text-zinc-600 hover:text-\[\#18181b\]/g, 'text-zinc-600 hover:text-[#1e293b]');
  content = content.replace(/text-zinc-900/g, 'text-slate-800'); // Slightly softer than zinc-900 for dark text
  content = content.replace(/bg-zinc-900/g, 'bg-slate-800'); 
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Updated leftovers ${file}`);
  }
});
