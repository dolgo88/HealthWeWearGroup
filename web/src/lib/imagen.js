/**
 * Preparación de la foto de perfil.
 *
 * Una foto de móvil pesa varios megas y no cabe en una celda de Google Sheets
 * (50.000 caracteres). Aquí se recorta a un cuadrado centrado, se reduce a un
 * tamaño de avatar y se comprime hasta que el resultado quepa de sobra.
 */

const LADO = 160;
const LIMITE = 36000; // caracteres del data URI, con margen sobre el de la celda

export async function prepararAvatar(fichero) {
  if (!fichero.type.startsWith('image/')) {
    throw new Error('Eso no parece una imagen.');
  }

  const imagen = await cargar(fichero);

  const lienzo = document.createElement('canvas');
  lienzo.width = LADO;
  lienzo.height = LADO;
  const ctx = lienzo.getContext('2d');

  // Recorte cuadrado centrado: se queda con el centro del lado más corto.
  const lado = Math.min(imagen.width, imagen.height);
  ctx.drawImage(
    imagen,
    (imagen.width - lado) / 2, (imagen.height - lado) / 2, lado, lado,
    0, 0, LADO, LADO
  );

  // Se baja la calidad por pasos hasta que quepa; rara vez pasa del primero.
  for (const calidad of [0.75, 0.6, 0.45, 0.32, 0.2]) {
    const datos = lienzo.toDataURL('image/jpeg', calidad);
    if (datos.length <= LIMITE) return datos;
  }

  throw new Error('No he conseguido comprimir esa imagen lo suficiente. Prueba con otra.');
}

function cargar(fichero) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error('No se pudo leer el fichero.'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => rechazar(new Error('No se pudo abrir la imagen.'));
      img.onload = () => resolver(img);
      img.src = lector.result;
    };
    lector.readAsDataURL(fichero);
  });
}
