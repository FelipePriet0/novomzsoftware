const fs = require('fs');
const s = fs.readFileSync(process.argv[2], 'utf8');
let stack = [];
let inStr = false, strCh = '', esc = false;
for (let i=0;i<s.length;i++){
  const ch = s[i];
  if (inStr){
    if (esc){ esc=false; continue; }
    if (ch==='\\'){ esc=true; continue; }
    if (ch===strCh){ inStr=false; continue; }
    continue;
  }
  if (ch==='"' || ch==='\'' || ch==='`'){ inStr=true; strCh=ch; continue; }
  if (ch==='('||ch==='['||ch==='{'){ stack.push({ch,pos:i}); }
  else if (ch===')'||ch===']'||ch==='}'){
    const top = stack.pop();
    if (!top){ console.log('Unmatched closing', ch, 'at', i); break; }
  }
}
if (stack.length){
  console.log('Unclosed brackets remain:', stack.length);
  const first = stack[0];
  const line = s.slice(0, first.pos).split(/\r?\n/).length;
  console.log('First unclosed at line', line, 'char', first.ch);
}
console.log('Done');
