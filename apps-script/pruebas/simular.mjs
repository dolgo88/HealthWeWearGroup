/*
 * Banco de pruebas del backend.
 *
 * Apps Script sólo se ejecuta en los servidores de Google, así que aquí se
 * simula lo justo de su API (hojas, rangos, Utilities, Properties, Lock) para
 * poder ejecutar Codigo.gs y Configurar.gs en Node y comprobar que funcionan
 * antes de tocar nada en la hoja de verdad.
 *
 *   node apps-script/pruebas/simular.mjs
 *
 * Se ejecuta desde la raíz del repositorio.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const NOOP = ['setFontWeight','setFontColor','setBackground','setHorizontalAlignment',
  'setVerticalAlignment','setWrap','setNumberFormat','setDataValidation','clearFormat',
  'setNote','setFontSize','setBorder'];

class Rango {
  constructor(hoja, fila, col, nFilas, nCols) {
    Object.assign(this, { hoja, fila, col, nFilas, nCols });
    for (const m of NOOP) this[m] = () => this;
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.nFilas; r++) {
      const fila = [];
      for (let c = 0; c < this.nCols; c++) fila.push(this.hoja._leer(this.fila + r, this.col + c));
      out.push(fila);
    }
    return out;
  }
  setValues(v) {
    if (v.length !== this.nFilas) throw new Error(`setValues: ${v.length} filas para un rango de ${this.nFilas}`);
    v.forEach((fila, r) => {
      if (fila.length !== this.nCols) throw new Error(`setValues: fila ${r} tiene ${fila.length} celdas, el rango tiene ${this.nCols}`);
      fila.forEach((val, c) => this.hoja._escribir(this.fila + r, this.col + c, val));
    });
    return this;
  }
  setValue(v) { this.hoja._escribir(this.fila, this.col, v); return this; }
  getValue() { return this.hoja._leer(this.fila, this.col); }
}

class Hoja {
  constructor(nombre) { this.nombre = nombre; this.celdas = new Map(); this.maxFilas = 1000; this.reglas = []; }
  getName() { return this.nombre; }
  _clave(r, c) { return r + ':' + c; }
  _leer(r, c) { const v = this.celdas.get(this._clave(r, c)); return v === undefined ? '' : v; }
  _escribir(r, c, v) { this.celdas.set(this._clave(r, c), v); }
  getMaxRows() { return this.maxFilas; }
  getLastRow() { let m = 0; for (const k of this.celdas.keys()) { const r = +k.split(':')[0]; if (this._leer(r, +k.split(':')[1]) !== '' && r > m) m = r; } return m; }
  getLastColumn() { let m = 0; for (const k of this.celdas.keys()) { const c = +k.split(':')[1]; if (this._leer(+k.split(':')[0], c) !== '' && c > m) m = c; } return m; }
  getRange(a, b, c, d) {
    if (typeof a === 'string') {
      const m = a.match(/^([A-Z]+)(\d+)$/);
      if (!m) throw new Error('notación A1 no soportada: ' + a);
      let col = 0; for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
      return new Rango(this, +m[2], col, 1, 1);
    }
    return new Rango(this, a, b, c ?? 1, d ?? 1);
  }
  getDataRange() { return new Rango(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  appendRow(v) { const r = this.getLastRow() + 1; v.forEach((val, i) => this._escribir(r, i + 1, val)); }
  deleteRow(r) {
    const nuevo = new Map();
    for (const [k, v] of this.celdas) { const [fr, fc] = k.split(':').map(Number); if (fr === r) continue; nuevo.set((fr > r ? fr - 1 : fr) + ':' + fc, v); }
    this.celdas = nuevo;
  }
  clear() { this.celdas = new Map(); return this; }
  setFrozenRows() { return this; }
  setColumnWidth() { return this; }
  setConditionalFormatRules(r) { this.reglas = r; return this; }
}

class Libro {
  constructor(nombre) { this.nombre = nombre; this.hojas = [new Hoja('Hoja 1')]; this.avisos = []; }
  getName() { return this.nombre; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/FALSA/edit'; }
  getSpreadsheetTimeZone() { return 'Europe/Madrid'; }
  getSheets() { return this.hojas; }
  getSheetByName(n) { return this.hojas.find((h) => h.getName() === n) ?? null; }
  insertSheet(n) { const h = new Hoja(n); this.hojas.push(h); return h; }
  deleteSheet(h) { this.hojas = this.hojas.filter((x) => x !== h); }
  setActiveSheet() { return this; }
  toast(t) { this.avisos.push(t); }
}

const libro = new Libro('HealthWeWear — Datos');
const encadenable = () => { const o = new Proxy({}, { get: (_, p) => (p === 'build' ? () => ({}) : () => encadenable()) }); return o; };

const props = new Map();
const contexto = {
  SpreadsheetApp: {
    // SUELTO=1 simula un script creado fuera de la hoja, que es el fallo
    // de instalación más habitual: ahí no hay hoja activa y se abre por ID.
    getActiveSpreadsheet: () => (process.env.SUELTO ? null : libro),
    openById: () => libro,
    getUi: () => { throw new Error('sin interfaz'); },
    newDataValidation: () => encadenable(),
    newConditionalFormatRule: () => encadenable()
  },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    formatDate: (d, tz, f) => {
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    },
    computeHmacSha256Signature: (t, k) => Array.from(crypto.createHmac('sha256', k).update(t).digest()),
    base64EncodeWebSafe: (x) => Buffer.from(typeof x === 'string' ? x : Uint8Array.from(x)).toString('base64url'),
    base64DecodeWebSafe: (x) => Array.from(Buffer.from(x, 'base64url')),
    newBlob: (b) => ({ getDataAsString: () => Buffer.from(Uint8Array.from(b)).toString('utf8') })
  },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v) }) },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => ({ _texto: t }) }) },
  Logger: { log: (t) => console.log('   [log] ' + String(t).replace(/\n/g, '\n         ')) },
  console
};
vm.createContext(contexto);
vm.runInContext(fs.readFileSync('apps-script/Codigo.gs', 'utf8'), contexto, { filename: 'Codigo.gs' });

// El desplegable de funciones de Apps Script se queda con la primera del
// fichero, así que configurar() tiene que seguir siendo esa.
const primera = /^function (\w+)/m.exec(fs.readFileSync('apps-script/Codigo.gs', 'utf8'))[1];
if (primera !== 'configurar') {
  console.log(`✗ la primera función del fichero es ${primera}, debería ser configurar`);
  process.exitCode = 1;
}

const post = (cuerpo) => JSON.parse(contexto.doPost({ postData: { contents: JSON.stringify(cuerpo) } })._texto);
const paso = (n, fn) => { try { fn(); console.log('✓ ' + n); } catch (e) { console.log('✗ ' + n + ' → ' + e.message); process.exitCode = 1; } };

console.log('--- configurar() ---');
paso('configurar() se ejecuta', () => contexto.configurar());
paso('crea las tres pestañas', () => {
  const n = libro.getSheets().map((h) => h.getName());
  if (!n.includes('Usuarios') || !n.includes('Mediciones') || !n.includes('LEEME')) throw new Error('pestañas: ' + n.join(', '));
  if (n.includes('Hoja 1')) throw new Error('la hoja por defecto sigue ahí');
});
paso('cabeceras de Usuarios', () => {
  const c = libro.getSheetByName('Usuarios').getRange(1, 1, 1, 9).getValues()[0];
  if (c[0] !== 'usuario' || c[8] !== 'activo') throw new Error(c.join('|'));
});
paso('configurar() es idempotente', () => contexto.configurar());

console.log('\n--- anadirEjemplos() ---');
paso('anadirEjemplos() se ejecuta', () => contexto.anadirEjemplos());
paso('mete 2 usuarios y 28 mediciones', () => {
  const u = libro.getSheetByName('Usuarios').getLastRow() - 1;
  const m = libro.getSheetByName('Mediciones').getLastRow() - 1;
  if (u !== 2 || m !== 28) throw new Error(`usuarios=${u} mediciones=${m}`);
});
paso('no pisa datos existentes al repetir', () => {
  contexto.anadirEjemplos();
  if (libro.getSheetByName('Usuarios').getLastRow() - 1 !== 2) throw new Error('duplicó usuarios');
});

console.log('\n--- comprobar() ---');
paso('comprobar() se ejecuta', () => contexto.comprobar());

console.log('\n--- API ---');
let token;
paso('login con credenciales malas falla', () => { if (post({ accion: 'login', usuario: 'ana', password: 'no' }).ok) throw new Error('dejó entrar'); });
paso('login correcto devuelve token y perfil', () => {
  const r = post({ accion: 'login', usuario: 'ANA', password: 'cambiame' });
  if (!r.ok) throw new Error(r.error);
  if (r.usuario.password !== undefined) throw new Error('¡la contraseña sale hacia la app!');
  if (r.datos.mediciones.length !== 28) throw new Error('mediciones: ' + r.datos.mediciones.length);
  token = r.token;
});
paso('token inválido se rechaza', () => { if (post({ accion: 'datos', token: token + 'x' }).ok) throw new Error('aceptó token falso'); });
paso('guardar crea una medición nueva', () => {
  const r = post({ accion: 'guardar', token, fecha: '2020-01-15', peso_kg: '64,3', ejercicio: true, nota: 'coma decimal' });
  if (!r.ok || r.actualizado) throw new Error(JSON.stringify(r).slice(0, 120));
  const m = r.datos.mediciones.find((x) => x.fecha === '2020-01-15');
  if (!m || m.peso_kg !== 64.3) throw new Error('no parseó la coma: ' + JSON.stringify(m));
});
paso('guardar dos veces el mismo día actualiza', () => {
  const r = post({ accion: 'guardar', token, fecha: '2020-01-15', peso_kg: 63.9, ejercicio: false });
  if (!r.ok || !r.actualizado) throw new Error('creó fila duplicada');
  if (r.datos.mediciones.filter((x) => x.fecha === '2020-01-15').length !== 1) throw new Error('hay duplicados');
});
paso('peso fuera de rango se rechaza', () => { if (post({ accion: 'guardar', token, fecha: '2020-01-16', peso_kg: 900 }).ok) throw new Error('aceptó 900 kg'); });
paso('borrar elimina el día', () => {
  const r = post({ accion: 'borrar', token, fecha: '2020-01-15' });
  if (!r.ok || r.datos.mediciones.some((x) => x.fecha === '2020-01-15')) throw new Error('no borró');
});
paso('las mediciones salen ordenadas por fecha', () => {
  const f = post({ accion: 'datos', token }).datos.mediciones.map((m) => m.fecha);
  if (f.join() !== [...f].sort().join()) throw new Error('desordenadas');
});
