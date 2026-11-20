const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let responderConsulta;
let recibirEstado;
let cambiarServicio;
let repararDOM;
let barra;
let anexados = 0;
let ahora = Date.parse('2026-11-20T13:00:00Z');
class Reloj extends Date { static now() { return ahora; } }
const temporizadores = new Map();
function elemento() {
  return {
    style:{}, dataset:{}, children:[], isConnected:false, offsetWidth:400, offsetHeight:50,
    addEventListener(){}, replaceChildren(){this.children=[];}, append(...items){this.children.push(...items);},
    getBoundingClientRect(){return {left:20,top:12};}
  };
}
const chrome = {
  runtime:{id:'notificador-test',onMessage:{addListener(fn){recibirEstado=fn;}},sendMessage(message,cb){responderConsulta=cb;}},
  storage:{local:{get(keys,cb){cb({servicioActivo:true});}},onChanged:{addListener(fn){cambiarServicio=fn;}}}
};
const document = {
  body:{appendChild(node){barra=node;node.isConnected=true;anexados++;}},
  createElement:elemento, addEventListener(){}, visibilityState:'visible'
};
class MutationObserver {
  constructor(callback){repararDOM=callback;} observe(){} disconnect(){}
}
vm.runInNewContext(fs.readFileSync('extension/whatsapp-injected.js','utf8'),{
  chrome,document,MutationObserver,window:{innerWidth:1200,innerHeight:800,addEventListener(){}},setInterval(fn,ms){temporizadores.set(ms,fn);return ms;},clearInterval(){},Date:Reloj,alert(){}
});
assert.equal(barra.style.display,'flex','Mostrar carga mientras llega el servidor');
assert.match(barra.textContent,/Conectando/);
responderConsulta({config:{servicioActivo:true},estado:{ok:true,enHorario:true,fase:'COMPLETADO',revisadoPor:'Matias',horaRevision:'10:39:22'}});
assert.equal(barra.style.display,'flex');
assert.match(barra.children[0].textContent,/Revisado por Matias/);
const estadoTemporal = {
  ok:true, enHorario:true, fase:'COMPLETADO', revisadoPor:'Matias Serantes',
  proximaRevisionMs:ahora + 60 * 60000, configuracion:{frecuenciaMin:60}
};
recibirEstado({tipo:'ESTADO_ACTUALIZADO',estado:estadoTemporal});
assert.equal(barra.children[0].textContent,'Revisado por Matias');
const inicio = ahora;
for (const [minutos,texto] of [
  [1,'Proxima alarma en 59 m'],
  [5,'Ultima revision Matias'],
  [6,'Proxima alarma en 54 m'],
  [10,'Proxima alarma en 50 m'],
  [30,'Proxima alarma en 30 m'],
  [60,'Se excedio el tiempo'],
  [61,'Revisar urgente'],
  [62,'Se excedio el tiempo']
]) {
  ahora = inicio + minutos * 60000;
  temporizadores.get(1000)();
  assert.equal(barra.children[0].textContent,texto);
  assert.equal(barra.className,minutos>=60?'alerta':'resuelto');
}
recibirEstado({tipo:'ESTADO_ACTUALIZADO',estado:{...estadoTemporal,proximaRevisionMs:ahora+60*60000,revisadoPor:'Alejandro Segura'}});
assert.equal(barra.children[0].textContent,'Revisado por Alejandro');
assert.equal(barra.className,'resuelto');
barra.isConnected=false;
repararDOM();
assert.equal(barra.isConnected,true,'Restaurar el globito eliminado por WhatsApp');
assert.equal(anexados,2);
repararDOM();assert.equal(anexados,2,'No duplicar el globito');
recibirEstado({tipo:'ESTADO_ACTUALIZADO',estado:{ok:true,enHorario:false}});
assert.equal(barra.style.display,'flex','Fuera de horario debe mostrar su estado');
assert.match(barra.textContent,/Fuera del horario/);
cambiarServicio({servicioActivo:{newValue:false}},'local');
assert.equal(barra.style.display,'none','Respetar pausa explicita');
console.log('OK: carga visible, revision registrada, recuperacion del DOM, sin duplicados y pausa');
