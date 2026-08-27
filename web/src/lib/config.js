/**
 * URL de la API (la aplicación web publicada desde Apps Script).
 *
 * Va aquí para que nadie tenga que teclearla: la app arranca directamente en
 * la pantalla de inicio de sesión. Se puede sustituir al compilar con la
 * variable de entorno VITE_API_URL, y cambiarla desde la propia app si algún
 * día se vuelve a publicar el script con otra URL.
 *
 * No es un secreto: cualquiera que abra la web puede leerla. Lo que protege
 * los datos es el usuario y la contraseña, no que esta dirección sea difícil
 * de encontrar.
 */
export const URL_API_POR_DEFECTO =
  'https://script.google.com/macros/s/AKfycbz0ZFDCwYHvEzieomxAbwq-78Qs-727oLBqqarHooSUIYQXjPVppnHmAWqpTdkJ8anK/exec';
