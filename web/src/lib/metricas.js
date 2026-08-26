/**
 * Cálculo de todas las métricas que muestra la app.
 * Funciones puras: entra el histórico de mediciones, sale el resumen.
 */

import { aIso, diasEntre, edadEnAnios, hoyIso, sumarDias } from './fechas.js';

/* ---------------------------------------------------------------- */
/*  Fórmulas básicas                                                 */
/* ---------------------------------------------------------------- */

export function calcularImc(pesoKg, alturaCm) {
  if (!pesoKg || !alturaCm) return null;
  const m = alturaCm / 100;
  return pesoKg / (m * m);
}

/**
 * Clasificación de la OMS. El "estado" mapea a los colores de estado del
 * sistema visual, y siempre va acompañado del texto — nunca color a secas.
 */
export function clasificarImc(imc) {
  if (imc === null || imc === undefined) return null;
  if (imc < 16)   return { etiqueta: 'Delgadez severa',   estado: 'critical' };
  if (imc < 17)   return { etiqueta: 'Delgadez moderada', estado: 'serious'  };
  if (imc < 18.5) return { etiqueta: 'Bajo peso',         estado: 'warning'  };
  if (imc < 25)   return { etiqueta: 'Peso normal',       estado: 'good'     };
  if (imc < 30)   return { etiqueta: 'Sobrepeso',         estado: 'warning'  };
  if (imc < 35)   return { etiqueta: 'Obesidad grado I',  estado: 'serious'  };
  if (imc < 40)   return { etiqueta: 'Obesidad grado II', estado: 'critical' };
  return { etiqueta: 'Obesidad grado III', estado: 'critical' };
}

/** Rango de peso con IMC entre 18,5 y 25 para una altura dada. */
export function rangoPesoSaludable(alturaCm) {
  if (!alturaCm) return null;
  const m = alturaCm / 100;
  return { min: 18.5 * m * m, max: 24.9 * m * m };
}

/** Metabolismo basal, fórmula de Mifflin-St Jeor (kcal/día en reposo). */
export function calcularTmb({ sexo, pesoKg, alturaCm, edad }) {
  if (!pesoKg || !alturaCm || edad === null || edad === undefined) return null;
  const base = 10 * pesoKg + 6.25 * alturaCm - 5 * edad;
  return sexo === 'F' ? base - 161 : base + 5;
}

/**
 * Gasto diario estimado. El factor sale de los días con ejercicio de la
 * última quincena, así que se mueve con lo que la persona hace de verdad.
 */
export function estimarGastoDiario(tmb, proporcionEjercicio) {
  if (tmb === null) return null;
  const factor = 1.2 + 0.35 * Math.min(Math.max(proporcionEjercicio ?? 0, 0), 1);
  return tmb * factor;
}

/* ---------------------------------------------------------------- */
/*  Series                                                           */
/* ---------------------------------------------------------------- */

/**
 * Media móvil centrada de N días sobre el calendario (no sobre el número
 * de registros), para que los huecos no distorsionen la tendencia.
 */
export function mediaMovil(serie, ventanaDias = 7) {
  const radio = Math.floor(ventanaDias / 2);
  return serie.map((punto) => {
    const desde = sumarDias(punto.fecha, -radio);
    const hasta = sumarDias(punto.fecha, radio);
    const dentro = serie.filter((p) => p.fecha >= desde && p.fecha <= hasta);
    const suma = dentro.reduce((acc, p) => acc + p.peso_kg, 0);
    return { fecha: punto.fecha, peso_kg: suma / dentro.length };
  });
}

/**
 * Regresión lineal por mínimos cuadrados sobre (día, peso).
 * Devuelve la pendiente en kg/día, que es de donde salen tanto la
 * tendencia semanal como la fecha estimada de llegada al objetivo.
 */
export function regresionLineal(serie) {
  if (serie.length < 2) return null;
  const origen = serie[0].fecha;
  const puntos = serie.map((p) => ({ x: diasEntre(origen, p.fecha), y: p.peso_kg }));
  const n = puntos.length;
  const sx = puntos.reduce((a, p) => a + p.x, 0);
  const sy = puntos.reduce((a, p) => a + p.y, 0);
  const sxy = puntos.reduce((a, p) => a + p.x * p.y, 0);
  const sxx = puntos.reduce((a, p) => a + p.x * p.x, 0);

  const denominador = n * sxx - sx * sx;
  if (denominador === 0) return null; // todas las mediciones el mismo día

  const pendiente = (n * sxy - sx * sy) / denominador;
  const interseccion = (sy - pendiente * sx) / n;

  const mediaY = sy / n;
  const ssTot = puntos.reduce((a, p) => a + (p.y - mediaY) ** 2, 0);
  const ssRes = puntos.reduce((a, p) => a + (p.y - (pendiente * p.x + interseccion)) ** 2, 0);

  return {
    kgPorDia: pendiente,
    kgPorSemana: pendiente * 7,
    r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot,
    origen,
    interseccion
  };
}

/** Peso registrado más cercano a N días atrás, sin pasarse del margen. */
function pesoHaceDias(serie, dias, margen = 4) {
  if (!serie.length) return null;
  const objetivo = sumarDias(serie[serie.length - 1].fecha, -dias);
  let mejor = null;
  let mejorDistancia = Infinity;
  for (const p of serie) {
    const d = Math.abs(diasEntre(p.fecha, objetivo));
    if (d < mejorDistancia) { mejor = p; mejorDistancia = d; }
  }
  return mejorDistancia <= margen ? mejor : null;
}

/* ---------------------------------------------------------------- */
/*  Rachas y constancia                                              */
/* ---------------------------------------------------------------- */

/** Días seguidos con ejercicio contando hacia atrás desde el último registro. */
export function rachaEjercicio(serie) {
  if (!serie.length) return 0;
  let racha = 0;
  let esperada = serie[serie.length - 1].fecha;
  for (let i = serie.length - 1; i >= 0; i--) {
    const p = serie[i];
    if (p.fecha !== esperada) break; // un día sin registrar corta la racha
    if (!p.ejercicio) break;
    racha += 1;
    esperada = sumarDias(esperada, -1);
  }
  return racha;
}

export function mejorRachaEjercicio(serie) {
  let mejor = 0;
  let actual = 0;
  let anterior = null;
  for (const p of serie) {
    const consecutivo = anterior !== null && diasEntre(anterior, p.fecha) === 1;
    actual = p.ejercicio ? (consecutivo ? actual + 1 : 1) : 0;
    if (actual > mejor) mejor = actual;
    anterior = p.fecha;
  }
  return mejor;
}

/* ---------------------------------------------------------------- */
/*  Resumen completo de una persona                                  */
/* ---------------------------------------------------------------- */

export function serieDe(mediciones, usuario) {
  return mediciones
    .filter((m) => m.usuario === usuario)
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

export function resumenDe(perfil, mediciones, referencia = hoyIso()) {
  const serie = serieDe(mediciones, perfil.usuario);

  if (!serie.length) {
    return { perfil, serie, tendencia: null, sinDatos: true, registros: 0 };
  }

  const ultimo   = serie[serie.length - 1];
  const primero  = serie[0];
  const pesos    = serie.map((p) => p.peso_kg);
  const imc      = calcularImc(ultimo.peso_kg, perfil.altura_cm);
  const edad     = edadEnAnios(perfil.fecha_nacimiento, referencia);

  const hace7  = pesoHaceDias(serie, 7);
  const hace30 = pesoHaceDias(serie, 30, 7);

  const desde30 = sumarDias(ultimo.fecha, -30);
  const ultimos30 = serie.filter((p) => p.fecha >= desde30);
  const desde14 = sumarDias(ultimo.fecha, -14);
  const ultimos14 = serie.filter((p) => p.fecha >= desde14);

  const tendencia = regresionLineal(ultimos30.length >= 2 ? ultimos30 : serie);

  const conEjercicio30 = ultimos30.filter((p) => p.ejercicio).length;
  const proporcionEjercicio = ultimos30.length ? conEjercicio30 / ultimos30.length : 0;
  const proporcionEjercicio14 = ultimos14.length
    ? ultimos14.filter((p) => p.ejercicio).length / ultimos14.length
    : 0;

  const tmb = calcularTmb({ sexo: perfil.sexo, pesoKg: ultimo.peso_kg, alturaCm: perfil.altura_cm, edad });

  return {
    perfil,
    serie,
    sinDatos: false,
    registros: serie.length,

    pesoActual:  ultimo.peso_kg,
    fechaActual: ultimo.fecha,
    pesoInicial: primero.peso_kg,
    fechaInicial: primero.fecha,

    cambioTotal: ultimo.peso_kg - primero.peso_kg,
    cambio7:  hace7  ? ultimo.peso_kg - hace7.peso_kg  : null,
    cambio30: hace30 ? ultimo.peso_kg - hace30.peso_kg : null,

    pesoMinimo: Math.min(...pesos),
    pesoMaximo: Math.max(...pesos),

    imc,
    categoriaImc: clasificarImc(imc),
    rangoSaludable: rangoPesoSaludable(perfil.altura_cm),
    edad,
    tmb,
    gastoEstimado: estimarGastoDiario(tmb, proporcionEjercicio14),

    tendencia,
    objetivo: calcularObjetivo(perfil, ultimo, tendencia, referencia),

    rachaEjercicio: rachaEjercicio(serie),
    mejorRacha: mejorRachaEjercicio(serie),
    diasEjercicio30: conEjercicio30,
    proporcionEjercicio,

    // Constancia: de los últimos 30 días naturales, en cuántos hay registro.
    diasRegistrados30: ultimos30.length,
    constancia: Math.min(ultimos30.length / Math.min(30, diasEntre(primero.fecha, ultimo.fecha) + 1), 1),

    diasDesdeUltima: diasEntre(ultimo.fecha, referencia)
  };
}

function calcularObjetivo(perfil, ultimo, tendencia, referencia) {
  const meta = perfil.peso_objetivo_kg;
  if (!meta) return null;

  const restante = ultimo.peso_kg - meta;
  const alcanzado = Math.abs(restante) < 0.3;

  let fechaEstimada = null;
  if (!alcanzado && tendencia && Math.abs(tendencia.kgPorDia) > 0.001) {
    const dias = restante / -tendencia.kgPorDia;
    // Sólo si la tendencia va hacia el objetivo y la estimación es creíble.
    if (dias > 0 && dias < 3 * 365) {
      fechaEstimada = sumarDias(referencia, Math.round(dias));
    }
  }

  return { meta, restante, alcanzado, fechaEstimada, avanzaHaciaMeta: fechaEstimada !== null };
}

/* ---------------------------------------------------------------- */
/*  Comparación entre personas                                       */
/* ---------------------------------------------------------------- */

/**
 * Indexa cada serie a su primer valor dentro del rango visible, en % de
 * cambio. Es la forma correcta de comparar personas de pesos distintos
 * en un único eje, sin recurrir a dos escalas.
 */
export function serieRelativa(serie) {
  if (!serie.length) return [];
  const base = serie[0].peso_kg;
  return serie.map((p) => ({ ...p, peso_kg: ((p.peso_kg - base) / base) * 100 }));
}

export function recortarDesde(serie, dias, referencia = hoyIso()) {
  if (dias === null) return serie;
  const desde = sumarDias(referencia, -dias);
  return serie.filter((p) => p.fecha >= desde);
}
