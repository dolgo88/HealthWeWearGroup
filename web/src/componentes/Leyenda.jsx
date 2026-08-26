import { useColorDeSerie } from '../lib/paleta.js';

/** Leyenda de líneas: la clave replica la marca del gráfico (un trazo). */
export default function Leyenda({ series }) {
  const adaptarColor = useColorDeSerie();
  if (series.length < 2) return null;
  return (
    <ul className="leyenda">
      {series.map((s) => (
        <li key={s.clave}>
          <svg width="16" height="10" aria-hidden="true">
            <line x1="0" y1="5" x2="16" y2="5" stroke={adaptarColor(s.color)} strokeWidth="2" strokeLinecap="round" />
          </svg>
          {s.nombre}
        </li>
      ))}
    </ul>
  );
}
