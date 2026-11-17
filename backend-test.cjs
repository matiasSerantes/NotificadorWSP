const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
let now=Date.parse('2026-11-16T14:00:00Z');
class Clock extends Date { constructor(...args){super(...(args.length?args:[now]));} }
const rows=Array.from({length:4},()=>Array(12).fill(''));
const configRows=[['Hora Inicio','08:00'],['Hora Fin','18:00'],['Frecuencia (min)',120],['Zona Horaria','America/Argentina/Buenos_Aires']];
const sheet={getLastRow:()=>rows.length,getRange(row,col,n=1,m=1){return {
getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>rows[row+i-1]?.[col+j-1]??'')),
setValues(values){values.forEach((r,i)=>r.forEach((v,j)=>{rows[row+i-1]??=Array(12).fill('');rows[row+i-1][col+j-1]=v;}));},setNumberFormat(){return this;}
};}};
const ss={getId:()=> 'test-sheet',getUrl:()=> 'https://docs.google.com/spreadsheets/d/test-sheet/edit',getSheetByName(name){if(name.includes('Registro'))return sheet;if(name.includes('Configuraci'))return {getLastRow:()=>7,getRange:()=>({getValues:()=>configRows})};return null;}};
let uuid=0;
const ctx=vm.createContext({Date:Clock,console,SpreadsheetApp:{openById:()=>ss,flush(){}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})},Utilities:{getUuid:()=>`revision-${++uuid}`,formatDate(d,tz,f){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(d).map(p=>[p.type,p.value]));const date=`${parts.year}-${parts.month}-${parts.day}`,time=`${parts.hour}:${parts.minute}:${parts.second}`;return ({'yyyy-MM-dd':date,'HH:mm:ss':time,'HH:mm':time.slice(0,5),'HH':parts.hour,'mm':parts.minute,'u':String(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(parts.weekday)+1),'yyyy-MM-dd HH:mm:ss':`${date} ${time}`})[f];}}});
vm.runInContext(fs.readFileSync('google-apps-script/Codigo.js','utf8'),ctx);
const status=()=>vm.runInContext('doGet({})',ctx);
const post=d=>{ctx.payload={postData:{contents:JSON.stringify(d)}};return vm.runInContext('doPost(payload)',ctx);};
configRows[2][1]=60;
now=Date.parse('2026-11-16T13:15:00Z');
let s=post({action:'registrar_revision',nombre:'Matias',correo:'m@example.com',requestId:'clic-1015-0001'});
assert.equal(s.ok,true);assert.equal(s.fase,'COMPLETADO');assert.equal(rows.length,5);
assert.equal(rows[4][4],'10:15:00');assert.equal(rows[4][5],'10:15:00');assert.equal(rows[4][9],'COMPLETADO');
assert.equal(s.proximaRevision,'2026-11-16 11:15:00');
now=Date.parse('2026-11-16T14:14:59Z');assert.equal(status().fase,'COMPLETADO');
now+=1000;assert.equal(status().fase,'PENDIENTE');
now=Date.parse('2026-11-16T14:25:00Z');
s=post({action:'registrar_revision',nombre:'Otro',correo:'o@example.com',requestId:'clic-1125-0002'});
assert.equal(s.proximaRevision,'2026-11-16 12:25:00');assert.equal(s.revisadoPor,'Otro');assert.equal(rows.length,6);
now+=30000;
s=post({action:'registrar_revision',nombre:'Otro',correo:'o@example.com',requestId:'clic-1125-0002'});
assert.equal(s.yaRegistrado,true);assert.equal(rows.length,6);assert.equal(s.proximaRevision,'2026-11-16 12:25:00');
now=Date.parse('2026-11-16T14:40:00Z');
s=post({action:'registrar_revision',nombre:'Matias',requestId:'clic-1140-0003'});
assert.equal(rows.length,7);assert.equal(s.proximaRevision,'2026-11-16 12:40:00','Revision anticipada reinicia contador compartido');
configRows[2][1]=120;assert.equal(status().proximaRevision,'2026-11-16 13:40:00');
assert.equal(post({action:'tomar_revision',nombre:'Matias'}).ok,false,'Cliente viejo recibe instruccion de actualizar');
assert.equal(post({action:'registrar_revision',nombre:'',requestId:'sin-nombre-0004'}).ok,false);
assert.equal(rows.length,7);
now=Date.parse('2026-11-16T22:00:00Z');assert.equal(post({action:'registrar_revision',nombre:'Matias',requestId:'fuera-hora-0005'}).ok,false);
console.log('OK: un clic = una fila completa; 10:15 -> 11:15; 11:25 -> 12:25; anticipo, reintento sin duplicado y horario laboral');
