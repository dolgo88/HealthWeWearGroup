/**
 * HealthWeWear — API de seguimiento de peso sobre Google Sheets.
 *
 * Este script vive dentro de la propia hoja de cálculo y se publica como
 * aplicación web. La app móvil habla con él por HTTPS enviando JSON.
 *
 * Puesta en marcha (una sola vez):
 *   1. Ejecuta la función  configurar()  desde el editor.
 *   2. Implementar > Nueva implementación > Aplicación web
 *        Ejecutar como:        Yo
 *        Quién tiene acceso:   Cualquier usuario
 *   3. Copia la URL /exec y pégala en la app.
 */

var HOJA_USUARIOS   = 'Usuarios';
var HOJA_MEDICIONES = 'Mediciones';
var DIAS_SESION     = 30;

var COLUMNAS_USUARIOS = [
  'usuario', 'password', 'nombre', 'sexo', 'altura_cm',
  'fecha_nacimiento', 'peso_objetivo_kg', 'color', 'activo'
];
var COLUMNAS_MEDICIONES = ['fecha', 'usuario', 'peso_kg', 'ejercicio', 'nota'];

/* Paleta por defecto que se reparte entre usuarios sin color propio.
   Orden fijo y validado para daltonismo — no lo reordenes a la ligera. */
var PALETA = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100',
  '#e87ba4', '#008300', '#4a3aa7', '#e34948'
];

/* ------------------------------------------------------------------ */
/*  Punto de entrada HTTP                                              */
/* ------------------------------------------------------------------ */

function doPost(e) {
  try {
    var peticion = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return responder(enrutar(peticion));
  } catch (err) {
    return responder({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet(e) {
  // Permite comprobar desde el navegador que la implementación responde.
  return responder({ ok: true, servicio: 'HealthWeWear', version: 1 });
}

function responder(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

function enrutar(p) {
  switch (p.accion) {
    case 'ping':    return { ok: true, servicio: 'HealthWeWear', version: 1 };
    case 'login':   return accionLogin(p);
    case 'datos':   return accionDatos(p);
    case 'guardar': return accionGuardar(p);
    case 'borrar':  return accionBorrar(p);
    default:        return { ok: false, error: 'Acción desconocida: ' + p.accion };
  }
}

/* ------------------------------------------------------------------ */
/*  Acciones                                                           */
/* ------------------------------------------------------------------ */

function accionLogin(p) {
  var usuario = String(p.usuario || '').trim().toLowerCase();
  var clave   = String(p.password || '');
  if (!usuario || !clave) return { ok: false, error: 'Falta usuario o contraseña.' };

  var fila = leerUsuarios().filter(function (u) { return u.usuario === usuario; })[0];

  // Mismo mensaje exista o no el usuario: no revelamos qué parte falla.
  if (!fila || fila.password !== clave) {
    return { ok: false, error: 'Usuario o contraseña incorrectos.' };
  }
  if (!fila.activo) {
    return { ok: false, error: 'Esta cuenta está desactivada. Habla con quien gestiona la hoja.' };
  }

  return {
    ok: true,
    token: crearToken(usuario),
    usuario: publico(fila),
    datos: instantanea()
  };
}

function accionDatos(p) {
  var sesion = validarToken(p.token);
  if (!sesion.ok) return sesion;
  return { ok: true, datos: instantanea() };
}

function accionGuardar(p) {
  var sesion = validarToken(p.token);
  if (!sesion.ok) return sesion;

  var fecha = normalizarFecha(p.fecha);
  if (!fecha) return { ok: false, error: 'Fecha no válida.' };

  var peso = normalizarNumero(p.peso_kg);
  if (peso === null || peso <= 0 || peso > 500) {
    return { ok: false, error: 'El peso debe ser un número entre 0 y 500 kg.' };
  }

  var ejercicio = p.ejercicio ? 'SI' : 'NO';
  var nota      = String(p.nota || '').slice(0, 500);

  var candado = LockService.getScriptLock();
  candado.waitLock(20000);
  try {
    var hoja   = hojaObligatoria(HOJA_MEDICIONES);
    var indice = indiceColumnas(hoja, COLUMNAS_MEDICIONES);
    var filas  = hoja.getDataRange().getValues();

    // Una única medición por persona y día: si ya existe, se sobrescribe.
    for (var i = 1; i < filas.length; i++) {
      var mismoUsuario = String(filas[i][indice.usuario]).trim().toLowerCase() === sesion.usuario;
      var mismoDia     = normalizarFecha(filas[i][indice.fecha]) === fecha;
      if (mismoUsuario && mismoDia) {
        hoja.getRange(i + 1, indice.peso_kg + 1).setValue(peso);
        hoja.getRange(i + 1, indice.ejercicio + 1).setValue(ejercicio);
        hoja.getRange(i + 1, indice.nota + 1).setValue(nota);
        return { ok: true, actualizado: true, datos: instantanea() };
      }
    }

    var nueva = [];
    nueva[indice.fecha]     = fecha;
    nueva[indice.usuario]   = sesion.usuario;
    nueva[indice.peso_kg]   = peso;
    nueva[indice.ejercicio] = ejercicio;
    nueva[indice.nota]      = nota;
    for (var c = 0; c < COLUMNAS_MEDICIONES.length; c++) {
      if (nueva[c] === undefined) nueva[c] = '';
    }
    hoja.appendRow(nueva);

    return { ok: true, actualizado: false, datos: instantanea() };
  } finally {
    candado.releaseLock();
  }
}

function accionBorrar(p) {
  var sesion = validarToken(p.token);
  if (!sesion.ok) return sesion;

  var fecha = normalizarFecha(p.fecha);
  if (!fecha) return { ok: false, error: 'Fecha no válida.' };

  var candado = LockService.getScriptLock();
  candado.waitLock(20000);
  try {
    var hoja   = hojaObligatoria(HOJA_MEDICIONES);
    var indice = indiceColumnas(hoja, COLUMNAS_MEDICIONES);
    var filas  = hoja.getDataRange().getValues();

    // De atrás hacia delante: borrar filas desplaza las de abajo.
    for (var i = filas.length - 1; i >= 1; i--) {
      var mismoUsuario = String(filas[i][indice.usuario]).trim().toLowerCase() === sesion.usuario;
      var mismoDia     = normalizarFecha(filas[i][indice.fecha]) === fecha;
      if (mismoUsuario && mismoDia) hoja.deleteRow(i + 1);
    }
    return { ok: true, datos: instantanea() };
  } finally {
    candado.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/*  Lectura de datos                                                   */
/* ------------------------------------------------------------------ */

function instantanea() {
  return {
    usuarios:   leerUsuarios().filter(function (u) { return u.activo; }).map(publico),
    mediciones: leerMediciones()
  };
}

/** Quita la contraseña antes de que nada salga hacia la app. */
function publico(u) {
  return {
    usuario:          u.usuario,
    nombre:           u.nombre || u.usuario,
    sexo:             u.sexo,
    altura_cm:        u.altura_cm,
    fecha_nacimiento: u.fecha_nacimiento,
    peso_objetivo_kg: u.peso_objetivo_kg,
    color:            u.color
  };
}

function leerUsuarios() {
  var hoja   = hojaObligatoria(HOJA_USUARIOS);
  var indice = indiceColumnas(hoja, COLUMNAS_USUARIOS);
  var filas  = hoja.getDataRange().getValues();
  var salida = [];

  for (var i = 1; i < filas.length; i++) {
    var f = filas[i];
    var usuario = String(f[indice.usuario] || '').trim().toLowerCase();
    if (!usuario) continue;

    var activoBruto = String(f[indice.activo] === undefined ? 'SI' : f[indice.activo]).trim().toUpperCase();

    salida.push({
      usuario:          usuario,
      password:         String(f[indice.password] === undefined ? '' : f[indice.password]),
      nombre:           String(f[indice.nombre] || '').trim(),
      sexo:             String(f[indice.sexo] || '').trim().toUpperCase().charAt(0) === 'F' ? 'F' : 'M',
      altura_cm:        normalizarNumero(f[indice.altura_cm]),
      fecha_nacimiento: normalizarFecha(f[indice.fecha_nacimiento]),
      peso_objetivo_kg: normalizarNumero(f[indice.peso_objetivo_kg]),
      color:            colorValido(f[indice.color]) || PALETA[salida.length % PALETA.length],
      // Vacío se interpreta como activo: así no hay que rellenar la columna.
      activo:           activoBruto !== 'NO' && activoBruto !== 'FALSE'
    });
  }
  return salida;
}

function leerMediciones() {
  var hoja   = hojaObligatoria(HOJA_MEDICIONES);
  var indice = indiceColumnas(hoja, COLUMNAS_MEDICIONES);
  var filas  = hoja.getDataRange().getValues();
  var salida = [];

  for (var i = 1; i < filas.length; i++) {
    var f = filas[i];
    var fecha   = normalizarFecha(f[indice.fecha]);
    var usuario = String(f[indice.usuario] || '').trim().toLowerCase();
    var peso    = normalizarNumero(f[indice.peso_kg]);
    if (!fecha || !usuario || peso === null) continue;

    salida.push({
      fecha:     fecha,
      usuario:   usuario,
      peso_kg:   peso,
      ejercicio: /^(SI|SÍ|S|YES|Y|TRUE|1|X)$/i.test(String(f[indice.ejercicio] || '').trim()),
      nota:      String(f[indice.nota] || '')
    });
  }

  salida.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
  return salida;
}

/* ------------------------------------------------------------------ */
/*  Sesiones                                                           */
/* ------------------------------------------------------------------ */

function secreto() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('SECRETO');
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('SECRETO', s);
  }
  return s;
}

function firmar(texto) {
  var bytes = Utilities.computeHmacSha256Signature(texto, secreto());
  return Utilities.base64EncodeWebSafe(bytes);
}

function crearToken(usuario) {
  var caduca = Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000;
  var cuerpo = usuario + '|' + caduca;
  return Utilities.base64EncodeWebSafe(cuerpo) + '.' + firmar(cuerpo);
}

function validarToken(token) {
  var partes = String(token || '').split('.');
  if (partes.length !== 2) return { ok: false, error: 'SESION_CADUCADA' };

  var cuerpo;
  try {
    cuerpo = Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[0])).getDataAsString();
  } catch (err) {
    return { ok: false, error: 'SESION_CADUCADA' };
  }

  if (firmar(cuerpo) !== partes[1]) return { ok: false, error: 'SESION_CADUCADA' };

  var trozos = cuerpo.split('|');
  if (Number(trozos[1]) < Date.now()) return { ok: false, error: 'SESION_CADUCADA' };

  return { ok: true, usuario: trozos[0] };
}

/* ------------------------------------------------------------------ */
/*  Utilidades de hoja                                                 */
/* ------------------------------------------------------------------ */

function hojaObligatoria(nombre) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!hoja) {
    throw new Error('Falta la hoja "' + nombre + '". Ejecuta la función configurar() una vez.');
  }
  return hoja;
}

/**
 * Localiza cada columna por el texto de su cabecera, no por su posición.
 * Así puedes reordenar o insertar columnas en la hoja sin romper la app.
 */
function indiceColumnas(hoja, esperadas) {
  var cabeceras = hoja.getRange(1, 1, 1, Math.max(hoja.getLastColumn(), 1))
                      .getValues()[0]
                      .map(function (c) { return String(c || '').trim().toLowerCase(); });
  var indice = {};
  esperadas.forEach(function (nombre) {
    var pos = cabeceras.indexOf(nombre);
    if (pos === -1) {
      throw new Error('Falta la columna "' + nombre + '" en la hoja "' + hoja.getName() +
                      '". Ejecuta configurar() para restaurar las cabeceras.');
    }
    indice[nombre] = pos;
  });
  return indice;
}

function normalizarNumero(valor) {
  if (valor === '' || valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return isNaN(valor) ? null : valor;
  // Admite tanto "64.5" como "64,5", que es lo que sale de un teclado español.
  var n = parseFloat(String(valor).replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

/** Devuelve siempre AAAA-MM-DD, venga la fecha como texto o como celda de fecha. */
function normalizarFecha(valor) {
  if (valor === '' || valor === null || valor === undefined) return null;

  if (Object.prototype.toString.call(valor) === '[object Date]') {
    return Utilities.formatDate(valor, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  }

  var texto = String(valor).trim();
  var iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return iso[1] + '-' + dosDigitos(iso[2]) + '-' + dosDigitos(iso[3]);

  // Formato español: 12/4/1990
  var es = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (es) return es[3] + '-' + dosDigitos(es[2]) + '-' + dosDigitos(es[1]);

  return null;
}

function dosDigitos(n) {
  return ('0' + String(n)).slice(-2);
}

function colorValido(valor) {
  var c = String(valor || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : null;
}
