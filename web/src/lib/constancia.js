/**
 * La regla del grupo: al menos dos días de ejercicio por semana.
 *
 * Si una semana no llegas a dos, la siguiente tienes que compensar y hacer
 * tres. El recargo dura sólo esa semana: cumplas o no los tres, lo que decide
 * el requisito de la semana siguiente es si hiciste dos o más.
 *
 * Las semanas van de lunes a domingo.
 */

import { aFecha, aIso, diasEntre, hoyIso, sumarDias } from './fechas.js';

export const MINIMO_SEMANAL = 2;
export const MINIMO_CON_RECARGO = 3;

/** Lunes de la semana a la que pertenece una fecha. */
export function inicioSemana(iso) {
  const f = aFecha(iso);
  const diaSemana = (f.getDay() + 6) % 7; // 0 = lunes
  return sumarDias(iso, -diaSemana);
}

/**
 * Una entrada por semana, desde la primera medición hasta la semana en curso,
 * incluidas las semanas sin ningún registro: saltárselas escondería justo lo
 * que interesa ver.
 */
export function semanasDe(serie, referencia = hoyIso()) {
  if (!serie.length) return [];

  const primera = inicioSemana(serie[0].fecha);
  const actual = inicioSemana(referencia);
  const semanas = [];

  for (let inicio = primera; inicio <= actual; inicio = sumarDias(inicio, 7)) {
    const fin = sumarDias(inicio, 6);
    const dentro = serie.filter((p) => p.fecha >= inicio && p.fecha <= fin);
    const sesiones = dentro.filter((p) => p.ejercicio).length;

    const anterior = semanas[semanas.length - 1];
    // El recargo lo dispara no haber llegado al mínimo, no fallar el requisito.
    const requerido = anterior && anterior.sesiones < MINIMO_SEMANAL
      ? MINIMO_CON_RECARGO
      : MINIMO_SEMANAL;

    semanas.push({
      inicio,
      fin,
      sesiones,
      requerido,
      registros: dentro.length,
      enCurso: inicio === actual,
      cumplida: sesiones >= requerido,
      conRecargo: requerido === MINIMO_CON_RECARGO
    });
  }

  return semanas;
}

/** Cuántos días de ejercicio necesitas la semana que viene si hoy se cerrara. */
export function requeridoSiguienteSemana(semanas) {
  const ultima = semanas[semanas.length - 1];
  if (!ultima) return MINIMO_SEMANAL;
  return ultima.sesiones < MINIMO_SEMANAL ? MINIMO_CON_RECARGO : MINIMO_SEMANAL;
}

export function estadoConstancia(serie, referencia = hoyIso()) {
  const semanas = semanasDe(serie, referencia);
  if (!semanas.length) return { semanas, sinDatos: true };

  const actual = semanas[semanas.length - 1];
  const cerradas = semanas.slice(0, -1);

  // Racha de semanas cerradas cumplidas, contando hacia atrás.
  let racha = 0;
  for (let i = cerradas.length - 1; i >= 0 && cerradas[i].cumplida; i--) racha += 1;

  let fallosSeguidos = 0;
  for (let i = cerradas.length - 1; i >= 0 && !cerradas[i].cumplida; i--) fallosSeguidos += 1;

  const media = (lista) =>
    lista.length ? lista.reduce((a, s) => a + s.sesiones, 0) / lista.length : 0;
  const recientes = media(cerradas.slice(-4));
  const previas = media(cerradas.slice(-8, -4));

  const diasRestantes = Math.max(diasEntre(referencia, actual.fin), 0);
  const faltan = Math.max(actual.requerido - actual.sesiones, 0);

  return {
    semanas,
    cerradas,
    actual,
    sinDatos: false,
    racha,
    fallosSeguidos,
    diasRestantes,
    faltan,
    // Con menos de dos semanas cerradas no hay con qué comparar todavía.
    mejorando: cerradas.length >= 2 && recientes > previas + 0.25,
    empeorando: cerradas.length >= 2 && recientes < previas - 0.25,
    mediaReciente: recientes,
    // Imposible ya: quedan menos días que sesiones pendientes.
    inalcanzable: faltan > diasRestantes + 1,
    totalCumplidas: semanas.filter((s) => s.cumplida).length
  };
}

/**
 * El mensaje de la pestaña. Se juzga la constancia con el ejercicio, que es
 * una conducta y depende de la persona; nunca el peso ni el cuerpo, que no
 * responden a un tirón de orejas.
 */
export function mensajeConstancia(estado, nombre) {
  if (estado.sinDatos) {
    return {
      tono: 'neutro',
      titulo: 'Aún no hay nada que juzgar',
      texto: 'Registra tu primer día y empezamos a contar. Dos días de ejercicio por semana, ni uno menos.'
    };
  }

  const { actual, faltan, diasRestantes, racha, fallosSeguidos } = estado;

  if (fallosSeguidos >= 3) {
    return {
      tono: 'critical',
      titulo: 'Bajaste los brazos',
      texto: `${fallosSeguidos} semanas seguidas sin cumplir. Esto ya no es un mal momento, ` +
             `es una costumbre. Esta semana necesitas ${actual.requerido} días: empieza hoy, ` +
             'no el lunes que viene.'
    };
  }

  if (actual.cumplida && racha >= 3) {
    return {
      tono: 'good',
      titulo: `${racha + 1} semanas seguidas`,
      texto: `Semana cumplida y van ${racha + 1} seguidas, ${nombre}. Esto ya no es fuerza de ` +
             'voluntad, es rutina. Lo difícil ya lo has hecho.'
    };
  }

  if (actual.cumplida) {
    return {
      tono: 'good',
      titulo: 'Semana cumplida',
      texto: fallosSeguidos > 0
        ? 'Venías de fallar y has remontado. Eso cuenta más que una racha larga: encadena otra.'
        : `${actual.sesiones} de ${actual.requerido}. Cumplido. Cualquier día de más ya es ganancia.`
    };
  }

  if (estado.inalcanzable) {
    return {
      tono: 'critical',
      titulo: 'Esta semana ya no sale',
      texto: `Te faltan ${faltan} días y sólo quedan ${diasRestantes}. Asúmelo y muévete igual: ` +
             `cada día que hagas ahora resta trabajo a la semana que viene, que arrancará ` +
             `pidiéndote ${MINIMO_CON_RECARGO}.`
    };
  }

  if (actual.conRecargo) {
    return {
      tono: 'warning',
      titulo: 'Semana de compensación',
      texto: `La semana pasada no llegaste a ${MINIMO_SEMANAL}, así que ésta te toca ${MINIMO_CON_RECARGO}. ` +
             `Llevas ${actual.sesiones} y te faltan ${faltan} en ${diasRestantes} días. Tú lo has buscado.`
    };
  }

  if (diasRestantes <= 2 && faltan > 0) {
    return {
      tono: 'warning',
      titulo: 'Se acaba la semana',
      texto: `Te ${faltan === 1 ? 'falta 1 día' : `faltan ${faltan} días`} y quedan ${diasRestantes}. ` +
             `Si no lo cierras, la semana que viene son ${MINIMO_CON_RECARGO}.`
    };
  }

  if (estado.mejorando) {
    return {
      tono: 'good',
      titulo: 'Vas a mejor',
      texto: `Este último mes te estás moviendo más que el anterior. Llevas ${actual.sesiones} de ` +
             `${actual.requerido} esta semana: no lo sueltes ahora.`
    };
  }

  if (estado.empeorando) {
    return {
      tono: 'warning',
      titulo: 'Aflojando',
      texto: `Te mueves menos que hace un mes. Llevas ${actual.sesiones} de ${actual.requerido} y ` +
             `quedan ${diasRestantes} días. Todavía estás a tiempo de que no se note.`
    };
  }

  return {
    tono: 'neutro',
    titulo: 'Semana en marcha',
    texto: `Llevas ${actual.sesiones} de ${actual.requerido}. Te ${faltan === 1 ? 'falta 1 día' : `faltan ${faltan}`} ` +
           `y quedan ${diasRestantes}. Vas con margen.`
  };
}
