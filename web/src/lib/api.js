/**
 * Cliente del Apps Script.
 *
 * Se envía como text/plain a propósito: así la petición cuenta como
 * "simple request" y el navegador no lanza un preflight OPTIONS, que
 * Apps Script no sabe responder. El cuerpo sigue siendo JSON.
 */

import { URL_API_POR_DEFECTO } from './config.js';

const CLAVE_URL     = 'hww.apiUrl';
const CLAVE_SESION  = 'hww.sesion';

export function urlApi() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  try {
    // Una URL puesta a mano manda sobre la de fábrica: permite apuntar a otra
    // hoja sin recompilar.
    return localStorage.getItem(CLAVE_URL) || URL_API_POR_DEFECTO;
  } catch {
    return URL_API_POR_DEFECTO;
  }
}

export function guardarUrlApi(url) {
  localStorage.setItem(CLAVE_URL, url.trim());
}

export function urlFijadaEnCompilacion() {
  return Boolean(import.meta.env.VITE_API_URL);
}

export function restaurarUrlPorDefecto() {
  try {
    localStorage.removeItem(CLAVE_URL);
  } catch {
    /* nada que hacer */
  }
}

export class ErrorApi extends Error {
  constructor(mensaje, { sesionCaducada = false } = {}) {
    super(mensaje);
    this.sesionCaducada = sesionCaducada;
  }
}

export async function llamar(accion, cuerpo = {}) {
  const url = urlApi();
  if (!url) throw new ErrorApi('Falta la URL de la API.');

  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: 'POST',
      // redirect: Apps Script responde con un 302 a googleusercontent.com
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion, ...cuerpo })
    });
  } catch {
    throw new ErrorApi('No se pudo conectar. Revisa tu conexión y la URL de la API.');
  }

  if (!respuesta.ok) {
    throw new ErrorApi(`El servidor respondió ${respuesta.status}. Revisa que la implementación esté publicada para "Cualquier usuario".`);
  }

  const texto = await respuesta.text();
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    // Apps Script devuelve HTML cuando la URL o los permisos no son correctos.
    throw new ErrorApi('La API devolvió algo que no es JSON. Suele significar que la URL no acaba en /exec o que la implementación no tiene acceso público.');
  }

  if (!datos.ok) {
    const caducada = datos.error === 'SESION_CADUCADA';
    throw new ErrorApi(caducada ? 'Tu sesión ha caducado. Vuelve a entrar.' : datos.error, { sesionCaducada: caducada });
  }

  return datos;
}

/* ---------------------------------------------------------------- */
/*  Sesión guardada en el dispositivo                                */
/* ---------------------------------------------------------------- */

export function leerSesion() {
  try {
    const bruto = localStorage.getItem(CLAVE_SESION);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion) {
  try {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  } catch {
    /* modo privado: la sesión durará sólo lo que dure la pestaña */
  }
}

export function borrarSesion() {
  try {
    localStorage.removeItem(CLAVE_SESION);
  } catch {
    /* nada que hacer */
  }
}
