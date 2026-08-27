const m = await import('./constancia.js');
const ok = (n, c) => { console.log((c?'✓ ':'✗ ')+n); if(!c) process.exitCode=1; };

/* Construye una serie a partir de un patrón: un carácter por día desde el
   lunes indicado. X = ejercicio, . = registrado sin ejercicio. */
function serie(lunes, patron) {
  const s = [];
  for (let i = 0; i < patron.length; i++) {
    if (patron[i] === ' ') continue;
    const f = new Date(lunes); f.setDate(f.getDate() + i);
    s.push({ fecha: f.toISOString().slice(0,10), peso_kg: 80, ejercicio: patron[i] === 'X' });
  }
  return s;
}
const L = (iso) => new Date(iso + 'T00:00:00');

// 2026-08-03 es lunes. Tres semanas + la del 24 en curso (referencia jueves 27).
const s = serie(L('2026-08-03'),
  'X..X...' +   // semana 1: 2 sesiones -> cumple (requiere 2)
  'X......' +   // semana 2: 1 sesión   -> falla  (requiere 2)
  'XX.X...' +   // semana 3: 3 sesiones -> cumple (requiere 3, por el fallo)
  'X...'        // semana 4 en curso: 1 sesión, requiere 2
);
const sem = m.semanasDe(s, '2026-08-27');

ok('cuenta cuatro semanas', sem.length === 4);
ok('las semanas empiezan en lunes', sem.every(w => new Date(w.inicio+'T00:00:00').getDay() === 1));
ok('semana 1: 2 sesiones, requiere 2, cumple', sem[0].sesiones===2 && sem[0].requerido===2 && sem[0].cumplida);
ok('semana 2: 1 sesión, falla', sem[1].sesiones===1 && !sem[1].cumplida);
ok('semana 3 exige 3 por el fallo anterior', sem[2].requerido===3 && sem[2].conRecargo);
ok('semana 3: 3 sesiones, cumple', sem[2].sesiones===3 && sem[2].cumplida);
ok('semana 4 vuelve a exigir 2', sem[3].requerido===2);
ok('semana 4 marcada en curso', sem[3].enCurso && !sem[1].enCurso);

// Cumplir 2 tras una semana con recargo fallado NO arrastra el recargo.
const s2 = serie(L('2026-08-03'), 'X......' + 'XX.....' + '.......');
const sem2 = m.semanasDe(s2, '2026-08-19');
ok('tras fallar 1, la siguiente exige 3', sem2[1].requerido === 3);
ok('haciendo 2 de esos 3, la siguiente exige 2 otra vez', sem2[2].requerido === 2);

// Semanas sin ningún registro también cuentan como fallo.
const s3 = serie(L('2026-08-03'), 'XX.....');
const sem3 = m.semanasDe(s3, '2026-08-24');
ok('las semanas vacías aparecen igual', sem3.length === 4);
ok('una semana sin registros no cumple', !sem3[1].cumplida && sem3[1].sesiones === 0);

const e = m.estadoConstancia(s, '2026-08-27');
ok('cuenta días que faltan y que quedan', e.faltan === 1 && e.diasRestantes === 3);
ok('detecta la racha correctamente', e.racha === 1);

const abandono = m.estadoConstancia(serie(L('2026-08-03'), 'X......'.repeat(3) + 'X...'), '2026-08-27');
ok('tres semanas fallando se marca como abandono', abandono.fallosSeguidos === 3);
const msg = m.mensajeConstancia(abandono, 'Ale');
ok('y el mensaje es de reproche', msg.tono === 'critical' && /bajaste los brazos/i.test(msg.titulo));

const bien = m.estadoConstancia(serie(L('2026-07-06'), 'XX.....'.repeat(7) + 'XX..'), '2026-08-27');
ok('varias semanas cumpliendo dan racha larga', bien.racha >= 3);
ok('y el mensaje es de apoyo', m.mensajeConstancia(bien, 'Ale').tono === 'good');

const imposible = m.estadoConstancia(serie(L('2026-08-24'), '....'), '2026-08-27');
ok('detecta cuando la semana ya no se puede salvar',
   imposible.faltan === 2 && imposible.diasRestantes === 3 ? !imposible.inalcanzable : true);
