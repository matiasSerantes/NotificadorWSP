const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let notifications = 0;
const store = {};
const event = { addListener() {} };
const chrome = {
 runtime: { onInstalled:event, onStartup:event, onMessage:event },
 storage: { local: { async get(keys, cb) { const data = Object.fromEntries(keys.map(k => [k,store[k]])); if(cb) cb(data); return data; }, async set(data) { Object.assign(store,data); } } },
 alarms: { onAlarm:event }, notifications: { onButtonClicked:event, onClicked:event }
};
const ctx = vm.createContext({chrome,console,setTimeout});
vm.runInContext(fs.readFileSync('extension/background.js','utf8'),ctx);
(async () => {
 ctx.recordNotification = () => notifications++;
 for(let i=0;i<20;i++) await vm.runInContext("notificarCambio({turnoActual:'2026-11-16 08:00',fase:'PENDIENTE'}, recordNotification)",ctx);
 assert.equal(notifications,1);
 await vm.runInContext("notificarCambio({turnoActual:'2026-11-16 08:30',fase:'PENDIENTE'}, recordNotification)",ctx);
 assert.equal(notifications,2);
 vm.runInContext("ultimaNotificacion = ''",ctx);
 await vm.runInContext("notificarCambio({turnoActual:'2026-11-16 08:30',fase:'PENDIENTE'}, recordNotification)",ctx);
 assert.equal(notifications,2,'No repetir al reiniciar el service worker');
 console.log('OK: consultas repetidas, turno nuevo y reinicio del service worker');
})().catch(e=>{ console.error(e); process.exitCode=1; });

const backend = vm.createContext({
  console,
  Utilities: { formatDate(date, tz, format) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(p=>[p.type,p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } }
});
vm.runInContext(fs.readFileSync('google-apps-script/Codigo.js','utf8'),backend);
assert.equal(vm.runInContext("extraerFechaLimpia('Mon Nov 16 2026 05:00:00 GMT-0300 (hora est?ndar de Argentina)', 'America/Argentina/Buenos_Aires')", backend), '2026-11-16');
vm.runInContext(`
obtenerConfiguracionDinamica = () => ({timezone:'America/Argentina/Buenos_Aires'});
obtenerHojaRegistro = () => ({getLastRow:()=>5, getRange:()=>({getValues:()=>[[1,new Date('2026-11-16T08:00:00Z'),'Lunes','11:00 - 11:30','11:01:00','11:02:00','Tecnico','correo',1,'OK']]})});
`,backend);
assert.equal(vm.runInContext("buscarEstadoSlot('2026-11-16 11:00').completado",backend), true);
assert.equal(vm.runInContext("buscarEstadoSlot('2026-11-16 11:30').completado",backend), false);
console.log('OK: fechas de Sheets y reconocimiento del turno completado');
