/**
 * Baldosa de estadística: un número protagonista, su etiqueta y un pie
 * opcional. El color de estado nunca va solo — siempre lleva texto.
 */
export function Tarjeta({ etiqueta, valor, unidad, pie, estado, ancha = false }) {
  return (
    <div className={`tarjeta${ancha ? ' tarjeta-ancha' : ''}`}>
      <div className="tarjeta-etiqueta">{etiqueta}</div>
      <div className="tarjeta-valor">
        {valor}
        {unidad && <span className="tarjeta-unidad">{unidad}</span>}
      </div>
      {pie && <div className={`tarjeta-pie${estado ? ` estado-${estado}` : ''}`}>{pie}</div>}
    </div>
  );
}

/** Variación con signo: la flecha y el texto llevan el significado, no el color. */
export function Delta({ valor, decimales = 1, unidad = 'kg', invertido = true }) {
  if (valor === null || valor === undefined) return <span className="atenuado">sin datos</span>;

  const redondeado = Number(valor.toFixed(decimales));
  if (redondeado === 0) return <span className="atenuado">sin cambio</span>;

  const baja = redondeado < 0;
  // En peso, bajar suele ser el objetivo: de ahí el "invertido" por defecto.
  const estado = (baja && invertido) || (!baja && !invertido) ? 'good' : 'neutro';

  return (
    <span className={`delta estado-${estado}`}>
      {baja ? '▼' : '▲'} {Math.abs(redondeado).toFixed(decimales)} {unidad}
    </span>
  );
}

/** Barra de progreso con su valor siempre escrito al lado. */
export function Barra({ proporcion, etiqueta, color }) {
  const pct = Math.round(Math.min(Math.max(proporcion, 0), 1) * 100);
  return (
    <div className="barra-bloque">
      <div className="barra-cabecera">
        <span>{etiqueta}</span>
        <strong>{pct}%</strong>
      </div>
      <div
        className="barra-pista"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={etiqueta}
      >
        <div className="barra-relleno" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
