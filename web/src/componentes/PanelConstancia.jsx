import { estadoConstancia, mensajeConstancia, MINIMO_CON_RECARGO, MINIMO_SEMANAL } from '../lib/constancia.js';
import { formatoCorto } from '../lib/fechas.js';
import { serieDe } from '../lib/metricas.js';
import { useColorDeSerie } from '../lib/paleta.js';
import Avatar from './Avatar.jsx';
import { Barra } from './Tarjeta.jsx';

const SEMANAS_VISIBLES = 12;

export default function PanelConstancia({ sesion, datos }) {
  const adaptarColor = useColorDeSerie();
  const perfil = datos.usuarios.find((u) => u.usuario === sesion.usuario.usuario) ?? sesion.usuario;
  const estado = estadoConstancia(serieDe(datos.mediciones, perfil.usuario));
  const mensaje = mensajeConstancia(estado, perfil.nombre);

  return (
    <section className="panel">
      <header className="panel-cabecera">
        <h2>Constancia</h2>
        <p className="ayuda">
          El trato: {MINIMO_SEMANAL} días de ejercicio por semana. Si una semana no llegas,
          la siguiente son {MINIMO_CON_RECARGO}.
        </p>
      </header>

      <div className={`veredicto tono-${mensaje.tono}`}>
        <h3>{mensaje.titulo}</h3>
        <p>{mensaje.texto}</p>
      </div>

      {!estado.sinDatos && (
        <>
          <div className="bloque">
            <h3>Esta semana</h3>
            <Barra
              proporcion={estado.actual.sesiones / estado.actual.requerido}
              etiqueta={`${estado.actual.sesiones} de ${estado.actual.requerido} días`}
              color={adaptarColor(perfil.color)}
            />
            <p className="ayuda pequena">
              {estado.actual.cumplida
                ? 'Ya está cumplida. Lo que hagas de más, mejor.'
                : `Quedan ${estado.diasRestantes} ${estado.diasRestantes === 1 ? 'día' : 'días'} de esta semana.`}
              {estado.actual.conRecargo && ' Esta semana lleva recargo por la anterior.'}
            </p>
          </div>

          <div className="bloque">
            <h3>Semana a semana</h3>
            <ol className="semanas" aria-label="Historial de semanas">
              {estado.semanas.slice(-SEMANAS_VISIBLES).map((s) => (
                <li
                  key={s.inicio}
                  className={
                    'semana' +
                    (s.enCurso ? ' en-curso' : s.cumplida ? ' cumplida' : ' fallada')
                  }
                >
                  <span className="semana-marca" aria-hidden="true">
                    {s.enCurso ? '·' : s.cumplida ? '✓' : '✗'}
                  </span>
                  <span className="semana-cuenta">
                    {s.sesiones}/{s.requerido}
                  </span>
                  <span className="semana-fecha">{formatoCorto(s.inicio)}</span>
                  <span className="visualmente-oculto">
                    Semana del {formatoCorto(s.inicio)}: {s.sesiones} de {s.requerido} días.
                    {s.enCurso ? ' En curso.' : s.cumplida ? ' Cumplida.' : ' No cumplida.'}
                  </span>
                </li>
              ))}
            </ol>
            <p className="ayuda pequena">
              {estado.racha > 0
                ? `Llevas ${estado.racha} ${estado.racha === 1 ? 'semana cerrada' : 'semanas cerradas'} seguidas cumpliendo.`
                : 'Aún no tienes ninguna racha de semanas cerradas. Empieza por ésta.'}
              {' '}Has cumplido {estado.totalCumplidas} de {estado.semanas.length} semanas.
            </p>
          </div>
        </>
      )}

      <div className="bloque">
        <h3>El grupo esta semana</h3>
        <ul className="lista-grupo">
          {datos.usuarios.map((u) => {
            const e = estadoConstancia(serieDe(datos.mediciones, u.usuario));
            const listo = !e.sinDatos && e.actual.cumplida;
            return (
              <li key={u.usuario}>
                <Avatar perfil={u} tamano={30} />
                <span className="nombre">
                  {u.nombre}
                  {u.usuario === perfil.usuario && <span className="atenuado"> (tú)</span>}
                </span>
                <span className={listo ? 'estado-good' : 'atenuado'}>
                  {e.sinDatos
                    ? 'sin datos'
                    : `${e.actual.sesiones}/${e.actual.requerido}${listo ? ' ✓' : ''}`}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="nota-tabla">
          Días de ejercicio de cada uno en la semana en curso, sobre los que le tocan.
        </p>
      </div>
    </section>
  );
}
