const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let now = Date.parse('2026-11-17T13:15:00Z');
class Clock extends Date { static now() { return now; } }
const store = {};
const alarms = new Map();
const notices = [];
const event = {addListener() {}};
const chrome = {
  runtime: {onInstalled:event, onStartup:event, onMessage:event},
  storage: {local: {async get(keys) {return Object.fromEntries(keys.map(key => [key,store[key]]));}, async set(data) {Object.assign(store,data);}}},
  alarms: {onAlarm:event, create(name,details) {alarms.set(name,details);}, clear(name) {alarms.delete(name);}},
  notifications: {onButtonClicked:event, onClicked:event, create(id,details) {notices.push({id,...details});}, clear() {}}
};
const ctx = vm.createContext({chrome, Date:Clock, console, setTimeout});
vm.runInContext(fs.readFileSync('extension/background.js','utf8'),ctx);
ctx.data = {enHorario:true,fase:'COMPLETADO',proximaRevisionMs:now+60*60000};
(async () => {
  vm.runInContext('programarProximoAviso(data)',ctx);
  assert.equal(alarms.get('wsp_preaviso').when,now+50*60000);
  await vm.runInContext('notificarPreaviso(data)',ctx);
  assert.equal(notices.length,0);
  now += 50*60000;
  await vm.runInContext('notificarPreaviso(data)',ctx);
  assert.equal(notices[0].message,'En 10 minutos hay que revisar WhatsApp.');
  await vm.runInContext('notificarPreaviso(data)',ctx);
  assert.equal(notices.length,1,'El preaviso no se repite al consultar');
  ctx.data.proximaRevisionMs = now+60*60000;
  vm.runInContext('programarProximoAviso(data)',ctx);
  assert.equal(alarms.get('wsp_preaviso').when,now+50*60000,'Otro clic reprograma el preaviso');
  now+=60*60000;
  await vm.runInContext('notificarPreaviso(data)',ctx);
  assert.equal(notices.length,1,'No emitir preaviso despues del vencimiento');
  ctx.data.proximaRevisionMs=now+10*60000;
  ctx.data.enHorario=false;
  await vm.runInContext('notificarPreaviso(data)',ctx);
  assert.equal(notices.length,1,'Respetar horario laboral');
  console.log('OK: preaviso a los 50 minutos, texto, deduplicacion, reprogramacion y horario');
})().catch(error => {console.error(error);process.exitCode=1;});
