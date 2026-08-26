import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { diasEntre, formatoCorto, formatoTooltip } from '../lib/fechas.js';
import { useColorDeSerie } from '../lib/paleta.js';

const MARGEN = { arriba: 14, derecha: 14, abajo: 32, izquierda: 46 };
const ANCHO_ETIQUETA = 46; // hueco reservado a la derecha para las etiquetas directas

/** Ticks redondos (1, 2, 2.5 o 5 por década) que cubren el rango. */
function ticksBonitos(min, max, deseados = 5) {
  if (!isFinite(min) || !isFinite(max)) return [];
  if (min === max) return [min];
  const bruto = (max - min) / deseados;
  const magnitud = 10 ** Math.floor(Math.log10(bruto));
  const normalizado = bruto / magnitud;
  const paso = (normalizado >= 5 ? 5 : normalizado >= 2.5 ? 5 : normalizado >= 2 ? 2 : 1) * magnitud;
  const ticks = [];
  for (let v = Math.ceil(min / paso) * paso; v <= max + paso * 0.001; v += paso) {
    ticks.push(Math.round(v / paso) * paso);
  }
  return ticks;
}

function useAncho(ref) {
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return undefined;
    const observador = new ResizeObserver(([entrada]) => setAncho(entrada.contentRect.width));
    observador.observe(nodo);
    setAncho(nodo.getBoundingClientRect().width);
    return () => observador.disconnect();
  }, [ref]);
  return ancho;
}

/**
 * Gráfico de líneas de evolución.
 *
 * @param series  [{ clave, nombre, color, puntos: [{ fecha, peso_kg, ejercicio }] }]
 * @param unidad  texto que acompaña a los valores ('kg' o '%')
 * @param tendencia  serie suavizada opcional que se dibuja de fondo punteada
 */
export default function GraficoLineas({
  series,
  unidad = 'kg',
  tendencia = null,
  altura = 240,
  decimales = 1,
  marcarEjercicio = false
}) {
  const contenedor = useRef(null);
  const ancho = useAncho(contenedor);
  const adaptarColor = useColorDeSerie();
  const [activo, setActivo] = useState(null); // índice de fecha bajo el puntero

  const conDatos = useMemo(
    () => series.filter((s) => s.puntos.length > 0).map((s) => ({ ...s, color: adaptarColor(s.color) })),
    [series, adaptarColor]
  );

  const modelo = useMemo(() => {
    if (!ancho || !conDatos.length) return null;

    const fechas = [...new Set(conDatos.flatMap((s) => s.puntos.map((p) => p.fecha)))].sort();
    if (!fechas.length) return null;

    const valores = conDatos.flatMap((s) => s.puntos.map((p) => p.peso_kg));
    if (tendencia) valores.push(...tendencia.map((p) => p.peso_kg));

    let minV = Math.min(...valores);
    let maxV = Math.max(...valores);
    // Un respiro arriba y abajo para que la línea no toque los bordes.
    const respiro = (maxV - minV) * 0.15 || Math.max(Math.abs(maxV) * 0.05, 0.5);
    minV -= respiro;
    maxV += respiro;

    const etiquetasDirectas = conDatos.length > 1 && conDatos.length <= 4 && ancho >= 340;
    const margenDerecha = MARGEN.derecha + (etiquetasDirectas ? ANCHO_ETIQUETA : 0);

    const x0 = MARGEN.izquierda;
    const x1 = Math.max(ancho - margenDerecha, x0 + 10);
    const y0 = MARGEN.arriba;
    const y1 = altura - MARGEN.abajo;

    const primera = fechas[0];
    const ultima = fechas[fechas.length - 1];
    const tramo = Math.max(diasEntre(primera, ultima), 1);

    const escalaX = (fecha) => x0 + ((x1 - x0) * diasEntre(primera, fecha)) / tramo;
    const escalaY = (v) => y1 - ((y1 - y0) * (v - minV)) / (maxV - minV || 1);

    const ticksY = ticksBonitos(minV, maxV, altura < 200 ? 3 : 5);

    // Como mucho 5 fechas en el eje: más se solapan en un móvil.
    const paso = Math.max(1, Math.ceil(fechas.length / 5));
    const ticksX = fechas.filter((_, i) => i % paso === 0 || i === fechas.length - 1);
    // Si el último tick cae encima del anterior, sobra el anterior.
    if (ticksX.length >= 2) {
      const separacion = escalaX(ticksX[ticksX.length - 1]) - escalaX(ticksX[ticksX.length - 2]);
      if (separacion < 52) ticksX.splice(ticksX.length - 2, 1);
    }

    return { fechas, escalaX, escalaY, x0, x1, y0, y1, ticksX, ticksY, etiquetasDirectas };
  }, [ancho, altura, conDatos, tendencia]);

  const alPuntero = useCallback(
    (evento) => {
      if (!modelo) return;
      const caja = contenedor.current.getBoundingClientRect();
      const x = evento.clientX - caja.left;
      let mejor = 0;
      let mejorDistancia = Infinity;
      modelo.fechas.forEach((f, i) => {
        const d = Math.abs(modelo.escalaX(f) - x);
        if (d < mejorDistancia) { mejor = i; mejorDistancia = d; }
      });
      setActivo(mejor);
    },
    [modelo]
  );

  if (!conDatos.length) {
    return <p className="vacio">Todavía no hay mediciones que dibujar.</p>;
  }

  const fechaActiva = modelo && activo !== null ? modelo.fechas[activo] : null;

  const filasTooltip = fechaActiva
    ? conDatos
        .map((s) => ({ serie: s, punto: s.puntos.find((p) => p.fecha === fechaActiva) }))
        .filter((f) => f.punto)
    : [];

  // El tooltip se coloca al otro lado del crosshair cuando se acerca al borde.
  const xActivo = fechaActiva ? modelo.escalaX(fechaActiva) : 0;
  const tooltipALaIzquierda = modelo && xActivo > (modelo.x0 + modelo.x1) / 2;

  return (
    <div className="grafico" ref={contenedor} style={{ height: altura }}>
      {modelo && (
        <svg
          width={ancho}
          height={altura}
          role="img"
          aria-label={`Evolución en ${unidad} de ${conDatos.map((s) => s.nombre).join(', ')}`}
          onPointerMove={alPuntero}
          onPointerDown={alPuntero}
          onPointerLeave={() => setActivo(null)}
          style={{ touchAction: 'pan-y' }}
        >
          {/* Rejilla: hairline recesiva, sólo horizontal */}
          {modelo.ticksY.map((t) => (
            <g key={t}>
              <line
                x1={modelo.x0} x2={modelo.x1}
                y1={modelo.escalaY(t)} y2={modelo.escalaY(t)}
                className="rejilla"
              />
              <text
                x={modelo.x0 - 8} y={modelo.escalaY(t)}
                className="eje" textAnchor="end" dominantBaseline="middle"
              >
                {t.toFixed(decimales)}
              </text>
            </g>
          ))}

          {modelo.ticksX.map((f) => (
            <text
              key={f}
              x={modelo.escalaX(f)} y={altura - 8}
              className="eje" textAnchor="middle"
            >
              {formatoCorto(f)}
            </text>
          ))}

          {/* Media móvil de fondo, punteada y sin protagonismo */}
          {tendencia && tendencia.length > 1 && (
            <path
              d={trazo(tendencia, modelo)}
              className="tendencia"
              stroke={conDatos[0].color}
            />
          )}

          {/* Crosshair: encuentra la fecha, se dibuja bajo las líneas */}
          {fechaActiva && (
            <line
              x1={xActivo} x2={xActivo} y1={modelo.y0} y2={modelo.y1}
              className="crosshair"
            />
          )}

          {conDatos.map((s) => {
            const ordenados = [...s.puntos].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
            return (
              <g key={s.clave}>
                {/* Halo del color de la superficie: en los cruces se ve
                    cuál pasa por encima sin ensuciar el color de la serie. */}
                {conDatos.length > 1 && (
                  <path d={trazo(ordenados, modelo)} className="linea halo" />
                )}
                <path d={trazo(ordenados, modelo)} className="linea" stroke={s.color} />

                {modelo.etiquetasDirectas && (
                  <text
                    x={modelo.escalaX(ordenados[ordenados.length - 1].fecha) + 8}
                    y={modelo.escalaY(ordenados[ordenados.length - 1].peso_kg)}
                    className="etiqueta-directa"
                    dominantBaseline="middle"
                  >
                    {s.nombre.slice(0, 6)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Días con ejercicio: una franja de marcas bajo el eje. Aguanta
              90 días sin taparlo, cosa que un punto por día no hace. */}
          {marcarEjercicio && conDatos.length === 1 &&
            conDatos[0].puntos.filter((p) => p.ejercicio).map((p) => (
              <line
                key={p.fecha}
                x1={modelo.escalaX(p.fecha)} x2={modelo.escalaX(p.fecha)}
                y1={modelo.y1 + 3} y2={modelo.y1 + 9}
                stroke={conDatos[0].color} strokeWidth="1.5" opacity="0.7"
              />
            ))}

          {/* Marcador del punto activo: 9px, por encima de todo */}
          {filasTooltip.map(({ serie, punto }) => (
            <circle
              key={serie.clave}
              cx={modelo.escalaX(punto.fecha)} cy={modelo.escalaY(punto.peso_kg)}
              r="4.5" fill={serie.color} className="anillo"
            />
          ))}
        </svg>
      )}

      {fechaActiva && filasTooltip.length > 0 && (
        <div
          className="tooltip"
          style={{
            left: tooltipALaIzquierda ? undefined : xActivo + 14,
            right: tooltipALaIzquierda ? ancho - xActivo + 14 : undefined
          }}
        >
          <div className="tooltip-fecha">{formatoTooltip(fechaActiva)}</div>
          {filasTooltip.map(({ serie, punto }) => (
            <div className="tooltip-fila" key={serie.clave}>
              <svg width="14" height="10" aria-hidden="true">
                <line x1="0" y1="5" x2="14" y2="5" stroke={serie.color} strokeWidth="2" strokeLinecap="round" />
              </svg>
              <strong>
                {punto.peso_kg > 0 && unidad === '%' ? '+' : ''}
                {punto.peso_kg.toFixed(decimales)} {unidad}
              </strong>
              <span>{serie.nombre}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function trazo(puntos, modelo) {
  return puntos
    .map((p, i) => `${i ? 'L' : 'M'}${modelo.escalaX(p.fecha).toFixed(1)},${modelo.escalaY(p.peso_kg).toFixed(1)}`)
    .join(' ');
}
