import { useState } from 'react';
import { formatoCorto } from '../lib/fechas.js';

/**
 * Vista de tabla del gráfico. No es un extra: es lo que mantiene los
 * valores accesibles sin depender del color ni del puntero.
 */
export default function TablaDatos({ series, unidad = 'kg', decimales = 1 }) {
  const [abierta, setAbierta] = useState(false);

  const fechas = [...new Set(series.flatMap((s) => s.puntos.map((p) => p.fecha)))].sort().reverse();
  if (!fechas.length) return null;

  return (
    <div className="tabla-bloque">
      <button className="enlace" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta}>
        {abierta ? 'Ocultar tabla' : `Ver tabla (${fechas.length} días)`}
      </button>

      {abierta && (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                {series.map((s) => (
                  <th scope="col" key={s.clave}>{s.nombre}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fechas.map((f) => (
                <tr key={f}>
                  <th scope="row">{formatoCorto(f)}</th>
                  {series.map((s) => {
                    const p = s.puntos.find((q) => q.fecha === f);
                    return (
                      <td key={s.clave}>
                        {p ? `${p.peso_kg > 0 && unidad === '%' ? '+' : ''}${p.peso_kg.toFixed(decimales)}` : '—'}
                        {p && p.ejercicio ? ' ·' : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="nota-tabla">Valores en {unidad}. El punto marca los días con ejercicio.</p>
        </div>
      )}
    </div>
  );
}
