const fs = require('fs');
const path = require('path');

const colorMap = {
  // Soften the black backgrounds
  'bg-[#18181b]': 'bg-[#1e293b]', // slate-800
  'text-[#18181b]': 'text-[#1e293b]', // slate-800 for text
  'border-[#18181b]': 'border-[#1e293b]',
  'focus:border-[#18181b]': 'focus:border-[#1e293b]',
  'hover:text-[#18181b]': 'hover:text-[#1e293b]',
  
  // Soften the zinc-800 backgrounds
  'bg-[#27272a]': 'bg-[#334155]', // slate-700
  'text-[#27272a]': 'text-[#334155]', 
  'border-[#27272a]': 'border-[#334155]',
  'hover:bg-[#27272a]': 'hover:bg-[#334155]',
  'ring-[#27272a]': 'ring-[#334155]',
  
  // Make sure emerald text on light bg is visible, emerald-600 is good.
  'text-emerald-500': 'text-emerald-600',
  'text-emerald-400': 'text-emerald-600', // Better contrast for text
};

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
  
  for (const [key, value] of Object.entries(colorMap)) {
    content = content.split(key).join(value);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
