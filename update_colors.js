const fs = require('fs');
const path = require('path');

const colorMap = {
  // Whites to soft zinc-50
  'bg-white': 'bg-[#fafafa]',
  'border-white': 'border-[#fafafa]',
  // App backgrounds to zinc-100
  'bg-[#f8f9fa]': 'bg-[#f4f4f5]',
  'bg-[#ecf3f8]': 'bg-[#f4f4f5]',
  'bg-[#f2f7fb]': 'bg-[#fafafa]',
  'bg-[#e5eff7]': 'bg-[#f4f4f5]',
  // Dark blues to zinc-900
  'bg-[#0f2942]': 'bg-[#18181b]',
  'bg-[#001e40]': 'bg-[#18181b]',
  'text-[#0f2942]': 'text-[#18181b]',
  'text-[#001e40]': 'text-[#18181b]',
  'border-[#001e40]': 'border-[#18181b]',
  // Medium dark blues to zinc-800/700
  'bg-[#193d5f]': 'bg-[#27272a]',
  'border-[#193d5f]': 'border-[#27272a]',
  'hover:bg-[#193d5f]': 'hover:bg-[#27272a]',
  'ring-[#193d5f]': 'ring-[#27272a]',
  // Borders
  'border-[#e1e3e4]': 'border-[#e4e4e7]',
  'border-[#dce6ef]': 'border-[#e4e4e7]',
  // Teals to Emeralds (Accounting vibes)
  'teal-400': 'emerald-400',
  'teal-500': 'emerald-500',
  'teal-600': 'emerald-600',
  'teal-300': 'emerald-300',
  'from-teal-400': 'from-emerald-400',
  'to-teal-500': 'to-emerald-500',
  'shadow-teal-500/20': 'shadow-emerald-500/10',
  'text-[#737780]': 'text-zinc-500',
  'text-[#43474f]': 'text-zinc-600',
  'text-[#191c1d]': 'text-zinc-900',
  'text-teal-100/60': 'text-[#a1a1aa]',
  'text-teal-100/80': 'text-[#d4d4d8]',
  'text-teal-100/70': 'text-[#a1a1aa]'
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
