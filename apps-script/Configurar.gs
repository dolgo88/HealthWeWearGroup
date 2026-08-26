/**
 * HealthWeWear — construcción y reparación de la hoja de cálculo.
 *
 * Ejecuta configurar() una vez al principio. Puedes volver a ejecutarla
 * cuando quieras: no borra datos, sólo repone cabeceras, formatos y
 * desplegables si algo se ha descolocado.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('HealthWeWear')
    .addItem('Configurar / reparar hojas', 'configurar')
    .addItem('Añadir filas de ejemplo', 'anadirEjemplos')
    .addToUi();
}

function configurar() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();

  var usuarios   = prepararHoja(libro, HOJA_USUARIOS,   COLUMNAS_USUARIOS,   [110, 110, 140, 70, 90, 140, 140, 90, 70]);
  var mediciones = prepararHoja(libro, HOJA_MEDICIONES, COLUMNAS_MEDICIONES, [110, 110, 90, 90, 260]);
  prepararLeeme(libro);

  // Sobra la hoja por defecto que trae todo libro nuevo.
  var sobrante = libro.getSheetByName('Hoja 1') || libro.getSheetByName('Sheet1') || libro.getSheetByName('Hoja1');
  if (sobrante && libro.getSheets().length > 1) libro.deleteSheet(sobrante);

  formatearUsuarios(usuarios);
  formatearMediciones(mediciones);

  libro.setActiveSheet(usuarios);
  secreto(); // genera y guarda la clave de firma de sesiones

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Hojas listas. Ahora publica el script: Implementar > Nueva implementación > Aplicación web.',
    'HealthWeWear', 10);
}

function prepararHoja(libro, nombre, columnas, anchos) {
  var hoja = libro.getSheetByName(nombre) || libro.insertSheet(nombre);

  hoja.getRange(1, 1, 1, columnas.length)
      .setValues([columnas])
      .setFontWeight('bold')
      .setFontColor('#ffffff')
      .setBackground('#1f3a5f')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');

  hoja.setFrozenRows(1);
  hoja.getRange(1, 1, 1, columnas.length).setWrap(true);
  anchos.forEach(function (ancho, i) { hoja.setColumnWidth(i + 1, ancho); });

  return hoja;
}

function formatearUsuarios(hoja) {
  var filas = Math.max(hoja.getMaxRows() - 1, 1);
  var col   = function (nombre) { return COLUMNAS_USUARIOS.indexOf(nombre) + 1; };

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
  var filas = Math.max(hoja.getMaxRows() - 1, 1);
  var col   = function (nombre) { return COLUMNAS_MEDICIONES.indexOf(nombre) + 1; };

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

function anadirEjemplos() {
  var libro      = SpreadsheetApp.getActiveSpreadsheet();
  var usuarios   = hojaObligatoria(HOJA_USUARIOS);
  var mediciones = hojaObligatoria(HOJA_MEDICIONES);

  if (usuarios.getLastRow() > 1) {
    libro.toast('La hoja Usuarios ya tiene datos: no toco nada.', 'HealthWeWear', 6);
    return;
  }

  usuarios.getRange(2, 1, 2, COLUMNAS_USUARIOS.length).setValues([
    ['ana',  'cambiame', 'Ana',  'F', 165, '1990-04-12', 60, '#2a78d6', 'SI'],
    ['luis', 'cambiame', 'Luis', 'M', 178, '1988-11-03', 78, '#eb6834', 'SI']
  ]);

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
