const fs = require('fs');
const path = require('path');

const colorMap = {
  // Catch any remaining blue tints and convert to nice neutral gray
  'bg-[#dce6ef]': 'bg-[#e4e4e7]',
  'border-[#dce6ef]': 'border-[#e4e4e7]',
  'bg-[#e5eff7]': 'bg-[#f4f4f5]',
  'border-[#e5eff7]': 'border-[#f4f4f5]', 
  'bg-slate-50': 'bg-zinc-50',
  'bg-slate-100': 'bg-zinc-100',
  'bg-slate-200': 'bg-zinc-200',
  'bg-slate-800': 'bg-zinc-800',
  'bg-slate-900': 'bg-zinc-900',
  'text-slate-300': 'text-zinc-300',
  'text-slate-400': 'text-zinc-400',
  'text-slate-500': 'text-zinc-500',
  'text-slate-600': 'text-zinc-600',
  'text-slate-700': 'text-zinc-700',
  'text-slate-900': 'text-zinc-900',
  'border-slate-100': 'border-zinc-100',
  'border-slate-200': 'border-zinc-200',
  'border-slate-700': 'border-zinc-700',
  // Make everything slightly rounder, and shadows softer
  'text-[#112a46]': 'text-zinc-900',
  'bg-[#112a46]': 'bg-zinc-900',
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
