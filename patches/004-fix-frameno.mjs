// stage 5.13 fix: the comment added by patch 003 swallowed the frameNo/queue declaration on the same line
import fs from 'node:fs';
const p='src/main.js';let s=fs.readFileSync(p,'utf8');
const a='shown until the new ones arrivelet frameNo=0,queue=[];';
if(s.split(a).length!==2)throw new Error(p+': expected exactly one match');
s=s.replace(a,()=>'shown until the new ones arrive\nlet frameNo=0,queue=[];');
fs.writeFileSync(p,s);console.log('ok',p);
