/**
 * HealthWeWear — seguimiento de peso en grupo sobre esta hoja de cálculo.
 *
 * TODO el backend está en este único fichero, a propósito: se pega entero y
 * ya está, sin ficheros extra que se puedan quedar por el camino.
 *
 * PUESTA EN MARCHA (una sola vez)
 *
 *   1. Pega este fichero entero en Extensiones > Apps Script, sustituyendo
 *      lo que hubiera, y guarda con el icono del disquete.
 *
 *   2. Arriba hay un desplegable de funciones: debe poner "configurar".
 *      Pulsa Ejecutar. Google te pedirá permiso la primera vez:
 *        Revisar permisos > tu cuenta > Configuración avanzada >
 *        Ir a HealthWeWear (no seguro) > Permitir
 *      Es tu propio script pidiendo acceso a tu propia hoja; ese aviso sale
 *      siempre con scripts sin verificar.
 *
 *   3. Vuelve a la hoja y recárgala (F5). Debe tener las pestañas Usuarios,
 *      Mediciones y LEEME, y un menú nuevo llamado HealthWeWear.
 *
 *   4. Publica la API: Implementar > Nueva implementación > (engranaje)
 *      Aplicación web > Ejecutar como: Yo > Acceso: Cualquier usuario >
 *      Implementar. Copia la URL que acaba en /exec y pégala en la app.
 *
 * ¿Algo no cuadra? Ejecuta la función "comprobar" y mira el registro
 * (Ver > Registro). Dice en cinco líneas qué falta.
 */


var HOJA_USUARIOS   = 'Usuarios';
var HOJA_MEDICIONES = 'Mediciones';
/* La sesión dura un año y se renueva sola en cada arranque de la app, así
   que en la práctica sólo termina cuando se pulsa Salir. */
var DIAS_SESION     = 365;

var COLUMNAS_USUARIOS = [
  'usuario', 'password', 'nombre', 'sexo', 'altura_cm',
  'fecha_nacimiento', 'peso_objetivo_kg', 'color', 'activo', 'avatar'
];

/*
 * Columnas que pueden faltar sin que nada se rompa. Así una hoja creada con
 * una versión anterior del script sigue funcionando: lo único que pasa es
 * que esa función concreta no está disponible hasta ejecutar configurar().
 */
var COLUMNAS_OPCIONALES = ['avatar'];

/* Un avatar es un emoji o una foto pequeña como data URI. El límite de una
   celda de Google Sheets son 50.000 caracteres; nos quedamos cómodamente por
   debajo. */
var MAXIMO_AVATAR = 40000;
var COLUMNAS_MEDICIONES = ['fecha', 'usuario', 'peso_kg', 'ejercicio', 'nota'];

/**
 * ID de la hoja de cálculo.
 *
 * Sólo se usa como red de seguridad: si el script se creó suelto en
 * script.google.com en vez de desde Extensiones > Apps Script, no hay
 * "hoja activa" y hay que abrirla por su ID. Con el script dentro de la
 * hoja este valor se ignora.
 *
 * Es el trozo largo de la URL de la hoja, entre /d/ y /edit.
 */
var ID_HOJA = '1NUU0DCMl5NJVjk1iw8bqVlsvdYojDrQNPf2pfnWV0nk';

/*
 * Versión de la API. La app comprueba este número al entrar y avisa si el
 * script publicado se ha quedado atrás.
 *
 * Es el fallo más habitual al actualizar: se pega el código nuevo en el
 * editor pero no se crea una versión nueva de la implementación, así que la
 * URL /exec sigue sirviendo el código viejo y las funciones recién añadidas
 * responden "Acción desconocida". Sube este número al añadir una acción.
 */
var VERSION_API = 2;

/* Paleta por defecto que se reparte entre usuarios sin color propio.
   Orden fijo y validado para daltonismo — no lo reordenes a la ligera. */
var PALETA = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100',
  '#e87ba4', '#008300', '#4a3aa7', '#e34948'
];

/* ------------------------------------------------------------------ */
/*  Acceso a la hoja de cálculo                                        */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Instalación — ejecuta configurar() una vez                      */
/* ------------------------------------------------------------------ */


function configurar() {
  var libro = documento();

  var usuarios   = prepararHoja(libro, HOJA_USUARIOS,   COLUMNAS_USUARIOS,   [110, 110, 140, 70, 90, 140, 140, 90, 70, 90]);
  var mediciones = prepararHoja(libro, HOJA_MEDICIONES, COLUMNAS_MEDICIONES, [110, 110, 90, 90, 260]);
  prepararLeeme(libro);

  // Sobra la hoja por defecto que trae todo libro nuevo.
  var sobrante = libro.getSheetByName('Hoja 1') || libro.getSheetByName('Sheet1') || libro.getSheetByName('Hoja1');
  if (sobrante && libro.getSheets().length > 1) libro.deleteSheet(sobrante);

  formatearUsuarios(usuarios);
  formatearMediciones(mediciones);

  libro.setActiveSheet(usuarios);
  secreto(); // genera y guarda la clave de firma de sesiones

  var resumen = 'Hojas listas en "' + libro.getName() + '": ' +
                libro.getSheets().map(function (h) { return h.getName(); }).join(', ') + '. ' +
                'Ahora publica el script: Implementar > Nueva implementación > Aplicación web.';

  // El toast sólo se ve si la hoja está abierta; el log se ve siempre.
  Logger.log(resumen);
  try {
    libro.toast(resumen, 'HealthWeWear', 10);
  } catch (err) {
    /* script suelto: no hay ventana donde mostrarlo */
  }
  return resumen;
}

/**
 * Diagnóstico. Ejecútala desde el editor y mira el registro
 * (Ver > Registro, o Ctrl+Intro): dice exactamente qué falta.
 */
function comprobar() {
  var lineas = [];

  var activa = null;
  try { activa = SpreadsheetApp.getActiveSpreadsheet(); } catch (err) { activa = null; }
  lineas.push(activa
    ? '✓ El script está dentro de la hoja.'
    : '! El script está suelto: se abrirá la hoja por ID_HOJA (' + ID_HOJA + ').');

  var doc;
  try {
    doc = documento();
  } catch (err) {
    lineas.push('✗ ' + err.message);
    Logger.log(lineas.join('\n'));
    return lineas.join('\n');
  }

  lineas.push('✓ Hoja: "' + doc.getName() + '" — ' + doc.getUrl());
  lineas.push('  Pestañas: ' + doc.getSheets().map(function (h) { return h.getName(); }).join(', '));

  [[HOJA_USUARIOS, COLUMNAS_USUARIOS], [HOJA_MEDICIONES, COLUMNAS_MEDICIONES]].forEach(function (par) {
    var hoja = doc.getSheetByName(par[0]);
    if (!hoja) {
      lineas.push('✗ Falta la pestaña "' + par[0] + '". Ejecuta configurar().');
      return;
    }
    try {
      indiceColumnas(hoja, par[1]);
      lineas.push('✓ "' + par[0] + '": cabeceras correctas, ' +
                  Math.max(hoja.getLastRow() - 1, 0) + ' filas de datos.');
    } catch (err) {
      lineas.push('✗ "' + par[0] + '": ' + err.message);
    }
  });

  try {
    var activos = leerUsuarios().filter(function (u) { return u.activo; });
    lineas.push('✓ Usuarios que pueden entrar: ' +
                (activos.length ? activos.map(function (u) { return u.usuario; }).join(', ') : 'ninguno todavía'));
  } catch (err) {
    lineas.push('✗ No se pudieron leer los usuarios: ' + err.message);
  }

  var texto = lineas.join('\n');
  Logger.log(texto);
  return texto;
}

function anadirEjemplos() {
  var libro      = documento();
  var usuarios   = hojaObligatoria(HOJA_USUARIOS);
  var mediciones = hojaObligatoria(HOJA_MEDICIONES);

  if (usuarios.getLastRow() > 1) {
    libro.toast('La hoja Usuarios ya tiene datos: no toco nada.', 'HealthWeWear', 6);
    return;
  }

  var indiceUsuarios = indiceColumnas(usuarios, COLUMNAS_USUARIOS);
  [
    { usuario: 'ana',  password: 'cambiame', nombre: 'Ana',  sexo: 'F', altura_cm: 165,
      fecha_nacimiento: '1990-04-12', peso_objetivo_kg: 60, color: '#2a78d6', activo: 'SI', avatar: '🍀' },
    { usuario: 'luis', password: 'cambiame', nombre: 'Luis', sexo: 'M', altura_cm: 178,
      fecha_nacimiento: '1988-11-03', peso_objetivo_kg: 78, color: '#eb6834', activo: 'SI', avatar: '🚴' }
  ].forEach(function (persona, i) {
    COLUMNAS_USUARIOS.forEach(function (columna) {
      if (indiceUsuarios[columna] !== -1) {
        usuarios.getRange(2 + i, indiceUsuarios[columna] + 1).setValue(persona[columna]);
      }
    });
  });

  var hoy   = new Date();
  var filas = [];
  for (var d = 13; d >= 0; d--) {
    var f = new Date(hoy.getTime() - d * 86400000);
    var iso = Utilities.formatDate(f, libro.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    filas.push([iso, 'ana',  Math.round((65.5 - (13 - d) * 0.08) * 10) / 10, d % 3 ? 'SI' : 'NO', '']);
    filas.push([iso, 'luis', Math.round((84.0 - (13 - d) * 0.11) * 10) / 10, d % 2 ? 'SI' : 'NO', '']);
  }
  mediciones.getRange(2, 1, filas.length, COLUMNAS_MEDICIONES.length).setValues(filas);

  libro.toast('Añadidos 2 usuarios de ejemplo (contraseña: cambiame) y 14 días de datos.', 'HealthWeWear', 8);
}

function onOpen() {
  // Sólo hay menú si el script vive dentro de la hoja. Si se creó suelto,
  // no hay interfaz que decorar y esto no debe tumbar la apertura.
  try {
    SpreadsheetApp.getUi()
      .createMenu('HealthWeWear')
      .addItem('Configurar / reparar hojas', 'configurar')
      .addItem('Añadir filas de ejemplo', 'anadirEjemplos')
      .addItem('Comprobar instalación', 'comprobar')
      .addToUi();
  } catch (err) {
    Logger.log('Sin interfaz de hoja: ' + err.message);
  }
}

/**
 * Diagnóstico. Ejecútala desde el editor y mira el registro
 * (Ver > Registro, o Ctrl+Intro): dice exactamente qué falta.
 */

/* ------------------------------------------------------------------ */
/*  Construcción de las hojas                                       */
/* ------------------------------------------------------------------ */


/**
 * Crea la hoja si no está y se asegura de que tenga todas las cabeceras.
 *
 * No reescribe las que ya existen: sólo añade al final las que falten. Así,
 * si has reordenado columnas o insertado alguna tuya, ejecutar configurar()
 * de nuevo no descoloca tus datos.
 */
function prepararHoja(libro, nombre, columnas, anchos) {
  var hoja = libro.getSheetByName(nombre) || libro.insertSheet(nombre);

  var existentes = hoja.getLastColumn() > 0
    ? hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0]
          .map(function (c) { return String(c || '').trim().toLowerCase(); })
    : [];

  var faltan = columnas.filter(function (c) { return existentes.indexOf(c) === -1; });
  faltan.forEach(function (nombreColumna, i) {
    hoja.getRange(1, existentes.length + i + 1).setValue(nombreColumna);
  });

  var total = existentes.length + faltan.length;
  hoja.getRange(1, 1, 1, total)
      .setFontWeight('bold')
      .setFontColor('#ffffff')
      .setBackground('#1f3a5f')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true);

  hoja.setFrozenRows(1);
  anchos.forEach(function (ancho, i) {
    if (i < total) hoja.setColumnWidth(i + 1, ancho);
  });

  return hoja;
}

function formatearUsuarios(hoja) {
  var filas  = Math.max(hoja.getMaxRows() - 1, 1);
  var indice = indiceColumnas(hoja, COLUMNAS_USUARIOS);
  var col    = function (nombre) { return indice[nombre] + 1; };

  hoja.getRange(2, col('fecha_nacimiento'), filas, 1).setNumberFormat('yyyy-mm-dd');
  hoja.getRange(2, col('altura_cm'),        filas, 1).setNumberFormat('0');
  hoja.getRange(2, col('peso_objetivo_kg'), filas, 1).setNumberFormat('0.0');

  aplicarLista(hoja, col('sexo'),   filas, ['M', 'F']);
  aplicarLista(hoja, col('activo'), filas, ['SI', 'NO']);

  // La contraseña en claro es intencionada: la idea es poder cambiarla aquí a mano.
  hoja.getRange(2, col('password'), filas, 1).setNote(
    'Contraseña en texto claro para poder editarla a mano.\n' +
    'No reutilices aquí una contraseña que uses en otro sitio.');
}

function formatearMediciones(hoja) {
  var filas  = Math.max(hoja.getMaxRows() - 1, 1);
  var indice = indiceColumnas(hoja, COLUMNAS_MEDICIONES);
  var col    = function (nombre) { return indice[nombre] + 1; };

  hoja.getRange(2, col('fecha'),   filas, 1).setNumberFormat('yyyy-mm-dd');
  hoja.getRange(2, col('peso_kg'), filas, 1).setNumberFormat('0.0');
  aplicarLista(hoja, col('ejercicio'), filas, ['SI', 'NO']);

  // Verde para el día con ejercicio, gris para el que no: se lee de un vistazo.
  var rango = hoja.getRange(2, col('ejercicio'), filas, 1);
  rango.clearFormat();
  rango.setNumberFormat('@');
  hoja.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('SI').setBackground('#d8f0d8').setFontColor('#0b5c0b')
      .setRanges([rango]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('NO').setBackground('#f0f0ee').setFontColor('#6b6b66')
      .setRanges([rango]).build()
  ]);
}

function aplicarLista(hoja, columna, filas, valores) {
  var regla = SpreadsheetApp.newDataValidation()
    .requireValueInList(valores, true)
    .setAllowInvalid(false)
    .setHelpText('Valores admitidos: ' + valores.join(' o '))
    .build();
  hoja.getRange(2, columna, filas, 1).setDataValidation(regla);
}

function prepararLeeme(libro) {
  var hoja = libro.getSheetByName('LEEME') || libro.insertSheet('LEEME');
  hoja.clear();

  var lineas = [
    ['HealthWeWear — guía de esta hoja', ''],
    ['', ''],
    ['Esta hoja es la base de datos de la app. Puedes editarla a mano cuando quieras.', ''],
    ['No cambies los nombres de las hojas ni el texto de la fila 1: la app los busca por ese nombre.', ''],
    ['Sí puedes reordenar columnas o insertar columnas nuevas — se localizan por su cabecera.', ''],
    ['', ''],
    ['HOJA "Usuarios" — una fila por persona', ''],
    ['usuario',          'Nombre de acceso, sin espacios. Al entrar no distingue mayúsculas.'],
    ['password',         'Contraseña de acceso, en texto claro para que puedas cambiarla aquí.'],
    ['nombre',           'Nombre que se muestra en la app.'],
    ['sexo',             'M o F. Se usa para calcular el metabolismo basal.'],
    ['altura_cm',        'Altura en centímetros, ej. 165. Se usa para el IMC.'],
    ['fecha_nacimiento', 'AAAA-MM-DD, ej. 1990-04-12. Da la edad para el metabolismo basal.'],
    ['peso_objetivo_kg', 'Peso al que quiere llegar. Puedes dejarlo vacío.'],
    ['color',            'Color de esa persona en los gráficos, ej. #2a78d6. Vacío = color automático.'],
    ['activo',           'SI o NO. Pon NO para quitarle el acceso sin borrar su historial.'],
    ['', ''],
    ['HOJA "Mediciones" — una fila por persona y día', ''],
    ['fecha',     'Día de la medición, AAAA-MM-DD.'],
    ['usuario',   'Debe coincidir con un "usuario" de la hoja Usuarios.'],
    ['peso_kg',   'Peso en kilos. Vale punto o coma decimal: 64.5 o 64,5.'],
    ['ejercicio', 'SI o NO.'],
    ['nota',      'Texto libre, opcional.'],
    ['', ''],
    ['Si alguien guarda dos veces el mismo día, la app actualiza esa fila en vez de crear otra.', ''],
    ['Así siempre hay como mucho una medición por persona y día.', '']
  ];

  hoja.getRange(1, 1, lineas.length, 2).setValues(lineas);
  hoja.setColumnWidth(1, 170);
  hoja.setColumnWidth(2, 620);
  hoja.getRange('A1').setFontSize(14).setFontWeight('bold').setFontColor('#1f3a5f');
  hoja.getRange('A7').setFontWeight('bold').setFontColor('#1f3a5f');
  hoja.getRange('A18').setFontWeight('bold').setFontColor('#1f3a5f');
  hoja.getRange(1, 1, lineas.length, 1).setFontWeight('bold');
  hoja.getRange('A1').setFontSize(14);
  hoja.setFrozenRows(0);
}

/* ------------------------------------------------------------------ */
/*  Acceso a la hoja de cálculo                                     */
/* ------------------------------------------------------------------ */


/**
 * La hoja sobre la que trabaja todo el script.
 *
 * Si el script vive dentro de la hoja, getActiveSpreadsheet() la devuelve.
 * Si se creó suelto, no hay hoja activa y se abre por ID. Que funcionen los
 * dos montajes evita el fallo más habitual al instalarlo.
 */
function documento() {
  var activa = null;
  try {
    activa = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {
    activa = null;
  }
  if (activa) return activa;

  if (!ID_HOJA || ID_HOJA.indexOf('PEGA') === 0) {
    throw new Error(
      'No hay ninguna hoja de cálculo asociada a este script. Ábrelo desde ' +
      'la hoja (Extensiones > Apps Script) o pon el ID de la hoja en la ' +
      'constante ID_HOJA, arriba del todo de Codigo.gs.');
  }

  try {
    return SpreadsheetApp.openById(ID_HOJA);
  } catch (err) {
    throw new Error('No se pudo abrir la hoja con ID ' + ID_HOJA + ': ' + err.message);
  }
}

/** La zona horaria se pide una vez, no una por cada fecha que se lee. */
var _zonaHoraria = null;

function zonaHoraria() {
  if (!_zonaHoraria) _zonaHoraria = documento().getSpreadsheetTimeZone();
  return _zonaHoraria;
}

/* ------------------------------------------------------------------ */
/*  Punto de entrada HTTP                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  API HTTP                                                        */
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
    case 'ping':    return { ok: true, servicio: 'HealthWeWear', version: VERSION_API };
    case 'login':   return accionLogin(p);
    case 'datos':   return accionDatos(p);
    case 'guardar': return accionGuardar(p);
    case 'borrar':  return accionBorrar(p);
    case 'avatar':  return accionAvatar(p);
    default:
      return {
        ok: false,
        error: 'Este script no conoce la acción "' + p.accion + '". Seguramente la ' +
               'implementación publicada es de una versión anterior: en el editor de ' +
               'Apps Script, Implementar > Gestionar implementaciones > lápiz > ' +
               'Versión: Nueva versión > Implementar.'
      };
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
    version: VERSION_API,
    token: crearToken(usuario),
    usuario: publico(fila),
    datos: instantanea()
  };
}

function accionDatos(p) {
  var sesion = validarToken(p.token);
  if (!sesion.ok) return sesion;
  // Token nuevo en cada arranque: mientras se use, la sesión no caduca.
  return { ok: true, version: VERSION_API, token: crearToken(sesion.usuario), datos: instantanea() };
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

/**
 * Guarda el avatar de quien tiene la sesión: un emoji o una foto pequeña
 * que la app ya ha recortado y comprimido antes de enviarla.
 */
function accionAvatar(p) {
  var sesion = validarToken(p.token);
  if (!sesion.ok) return sesion;

  var avatar = String(p.avatar === undefined || p.avatar === null ? '' : p.avatar);

  if (avatar.length > MAXIMO_AVATAR) {
    return { ok: false, error: 'La imagen es demasiado grande. Prueba con otra.' };
  }
  // Sólo emoji/texto corto o una imagen en línea: nada de URLs externas.
  if (avatar && avatar.length > 16 && avatar.indexOf('data:image/') !== 0) {
    return { ok: false, error: 'Formato de avatar no admitido.' };
  }

  var candado = LockService.getScriptLock();
  candado.waitLock(20000);
  try {
    var hoja   = hojaObligatoria(HOJA_USUARIOS);
    var indice = indiceColumnas(hoja, COLUMNAS_USUARIOS);

    if (indice.avatar === -1) {
      return { ok: false, error: 'Falta la columna "avatar" en la hoja Usuarios. Ejecuta configurar() una vez.' };
    }

    var filas = hoja.getDataRange().getValues();
    for (var i = 1; i < filas.length; i++) {
      if (String(filas[i][indice.usuario]).trim().toLowerCase() === sesion.usuario) {
        hoja.getRange(i + 1, indice.avatar + 1).setValue(avatar);
        return { ok: true, datos: instantanea() };
      }
    }
    return { ok: false, error: 'No encuentro tu fila en la hoja Usuarios.' };
  } finally {
    candado.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/*  Lectura de datos                                                   */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Lectura de datos                                                */
/* ------------------------------------------------------------------ */


function instantanea() {
  return {
    usuarios:   leerUsuarios().filter(function (u) { return u.activo; }).map(publico),
    mediciones: leerMediciones()
  };
}

/** Quita la contraseña antes de que nada salga hacia la app. */

/** Quita la contraseña antes de que nada salga hacia la app. */
function publico(u) {
  return {
    usuario:          u.usuario,
    nombre:           u.nombre || u.usuario,
    sexo:             u.sexo,
    altura_cm:        u.altura_cm,
    fecha_nacimiento: u.fecha_nacimiento,
    peso_objetivo_kg: u.peso_objetivo_kg,
    color:            u.color,
    avatar:           u.avatar
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
      avatar:           String(celda(f, indice.avatar) || ''),
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

/* ------------------------------------------------------------------ */
/*  Sesiones                                                        */
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

/* ------------------------------------------------------------------ */
/*  Utilidades de hoja                                              */
/* ------------------------------------------------------------------ */


function hojaObligatoria(nombre) {
  var hoja = documento().getSheetByName(nombre);
  if (!hoja) {
    throw new Error('Falta la hoja "' + nombre + '". Ejecuta la función configurar() una vez.');
  }
  return hoja;
}

/**
 * Localiza cada columna por el texto de su cabecera, no por su posición.
 * Así puedes reordenar o insertar columnas en la hoja sin romper la app.
 */

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
    if (pos === -1 && COLUMNAS_OPCIONALES.indexOf(nombre) === -1) {
      throw new Error('Falta la columna "' + nombre + '" en la hoja "' + hoja.getName() +
                      '". Ejecuta configurar() para restaurar las cabeceras.');
    }
    indice[nombre] = pos; // -1 si es opcional y no está
  });
  return indice;
}

/** Lee una celda tolerando que su columna no exista. */
function celda(fila, posicion) {
  return posicion === -1 || fila[posicion] === undefined ? '' : fila[posicion];
}

function normalizarNumero(valor) {
  if (valor === '' || valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return isNaN(valor) ? null : valor;
  // Admite tanto "64.5" como "64,5", que es lo que sale de un teclado español.
  var n = parseFloat(String(valor).replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

/** Devuelve siempre AAAA-MM-DD, venga la fecha como texto o como celda de fecha. */

/** Devuelve siempre AAAA-MM-DD, venga la fecha como texto o como celda de fecha. */
function normalizarFecha(valor) {
  if (valor === '' || valor === null || valor === undefined) return null;

  if (Object.prototype.toString.call(valor) === '[object Date]') {
    return Utilities.formatDate(valor, zonaHoraria(), 'yyyy-MM-dd');
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
