import { useEffect, useState } from 'react';
import { llamar } from '../lib/api.js';
import { formatoCorto, formatoLargo, formatoRelativo, hoyIso } from '../lib/fechas.js';
import { serieDe } from '../lib/metricas.js';
import Avatar from './Avatar.jsx';

/**
 * Compara con la medición anterior a ese día —no con la última de todas—,
 * para que corregir un día pasado reaccione a lo que de verdad pasó entonces.
 * Medio hectogramo de margen: la báscula no repite el mismo número dos veces.
 */
function reaccionAlPeso(mediciones, usuario, fecha, peso) {
  const previas = mediciones
    .filter((m) => m.usuario === usuario && m.fecha < fecha)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

  const anterior = previas[previas.length - 1];
  if (!anterior) {
    return {
      tipo: 'inicio',
      cara: '👋',
      frase: 'Primera medición guardada',
      detalle: 'A partir de aquí ya hay con qué comparar.'
    };
  }

  const diferencia = peso - anterior.peso_kg;
  const kg = Math.abs(diferencia).toFixed(1);
  const desde = `respecto a los ${anterior.peso_kg.toFixed(1)} kg del ${formatoCorto(anterior.fecha)}`;

  if (diferencia <= -0.05) {
    return { tipo: 'baja', cara: '❤️', frase: 'Seguí así', detalle: `${kg} kg menos ${desde}.` };
  }
  if (diferencia >= 0.05) {
    return { tipo: 'sube', cara: '😢', frase: 'Me has decepcionado', detalle: `${kg} kg más ${desde}.` };
  }
  return { tipo: 'igual', cara: '➖', frase: 'Sin cambios', detalle: `El mismo peso ${desde}.` };
}

/** Registro diario: peso, si se ha hecho ejercicio y una nota opcional. */
export default function PanelHoy({ sesion, datos, alRefrescar, alError }) {
  const [fecha, setFecha] = useState(hoyIso());
  const [peso, setPeso] = useState('');
  const [ejercicio, setEjercicio] = useState(false);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [reaccion, setReaccion] = useState(null);

  const perfil = datos.usuarios.find((u) => u.usuario === sesion.usuario.usuario) ?? sesion.usuario;
  const serie = serieDe(datos.mediciones, sesion.usuario.usuario);
  const ultima = serie[serie.length - 1] ?? null;
  const existente = serie.find((p) => p.fecha === fecha) ?? null;

  // Al cambiar de día, el formulario refleja lo que ya haya guardado ese día.
  useEffect(() => {
    if (existente) {
      setPeso(String(existente.peso_kg));
      setEjercicio(existente.ejercicio);
      setNota(existente.nota || '');
    } else {
      // Arranca en el último peso conocido: se corrigen décimas, no se teclea de cero.
      setPeso(ultima ? String(ultima.peso_kg) : '');
      setEjercicio(false);
      setNota('');
    }
    setAviso(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, datos.mediciones]);

  /*
   * La reacción se borra sólo al cambiar de día, no cuando llegan datos
   * nuevos: si dependiera de las mediciones, el refresco que provoca el
   * propio guardado la haría desaparecer en el mismo instante en que se pone.
   */
  useEffect(() => { setReaccion(null); }, [fecha]);

  async function guardar(evento) {
    evento.preventDefault();
    setAviso(null);

    const valor = Number(String(peso).replace(',', '.'));
    if (!isFinite(valor) || valor <= 0 || valor > 500) {
      setAviso({ tipo: 'error', texto: 'Escribe un peso entre 0 y 500 kg.' });
      return;
    }

    setGuardando(true);
    try {
      const respuesta = await llamar('guardar', {
        token: sesion.token,
        fecha,
        peso_kg: valor,
        ejercicio,
        nota
      });
      alRefrescar(respuesta.datos, respuesta.token);
      setAviso({
        tipo: 'ok',
        texto: respuesta.actualizado ? 'Medición actualizada.' : 'Medición guardada.'
      });
      setReaccion(reaccionAlPeso(respuesta.datos.mediciones, sesion.usuario.usuario, fecha, valor));
    } catch (err) {
      if (err.sesionCaducada) alError(err);
      else setAviso({ tipo: 'error', texto: err.message });
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!existente) return;
    setGuardando(true);
    try {
      const respuesta = await llamar('borrar', { token: sesion.token, fecha });
      alRefrescar(respuesta.datos, respuesta.token);
      setReaccion(null);
      setAviso({ tipo: 'ok', texto: 'Medición borrada.' });
    } catch (err) {
      if (err.sesionCaducada) alError(err);
      else setAviso({ tipo: 'error', texto: err.message });
    } finally {
      setGuardando(false);
    }
  }

  const diferencia = ultima && peso ? Number(String(peso).replace(',', '.')) - ultima.peso_kg : null;

  return (
    <section className="panel">
      <header className="panel-cabecera">
        <div className="saludo">
          <Avatar perfil={perfil} tamano={44} />
          <h2>Hola, {perfil.nombre}</h2>
        </div>
        <p className="ayuda">
          {ultima
            ? `Tu última medición fue ${formatoRelativo(ultima.fecha)}: ${ultima.peso_kg.toFixed(1)} kg.`
            : 'Todavía no has registrado ninguna medición. Empieza hoy.'}
        </p>
      </header>

      <form className="bloque" onSubmit={guardar}>
        <label htmlFor="fecha">Día</label>
        <input
          id="fecha"
          type="date"
          value={fecha}
          max={hoyIso()}
          onChange={(e) => setFecha(e.target.value)}
          required
        />
        <p className="ayuda pequena">{formatoLargo(fecha)}</p>

        <label htmlFor="peso">Peso</label>
        <div className="campo-unidad">
          <input
            id="peso"
            type="text"
            inputMode="decimal"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            placeholder="64,5"
            required
          />
          <span>kg</span>
        </div>
        {diferencia !== null && Math.abs(diferencia) > 0.001 && fecha !== ultima?.fecha && (
          <p className="ayuda pequena">
            {diferencia < 0 ? '▼' : '▲'} {Math.abs(diferencia).toFixed(1)} kg respecto a tu última medición
          </p>
        )}

        <fieldset className="interruptor">
          <legend>¿Has hecho ejercicio?</legend>
          <div className="segmentado">
            <button
              type="button"
              className={ejercicio ? 'activo' : ''}
              aria-pressed={ejercicio}
              onClick={() => setEjercicio(true)}
            >
              Sí
            </button>
            <button
              type="button"
              className={!ejercicio ? 'activo' : ''}
              aria-pressed={!ejercicio}
              onClick={() => setEjercicio(false)}
            >
              No
            </button>
          </div>
        </fieldset>

        <label htmlFor="nota">Nota <span className="atenuado">(opcional)</span></label>
        <input
          id="nota"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Cómo te has sentido, qué has hecho…"
          maxLength={200}
        />

        {reaccion && (
          <div className={`reaccion reaccion-${reaccion.tipo}`} role="status">
            <span className="reaccion-cara" aria-hidden="true">{reaccion.cara}</span>
            <div>
              <strong>{reaccion.frase}</strong>
              {reaccion.detalle && <span className="reaccion-detalle">{reaccion.detalle}</span>}
            </div>
          </div>
        )}

        {aviso && !reaccion && (
          <p className={aviso.tipo === 'ok' ? 'exito' : 'error'} role="status">
            {aviso.texto}
          </p>
        )}

        <button type="submit" className="principal" disabled={guardando}>
          {guardando ? 'Guardando…' : existente ? 'Actualizar medición' : 'Guardar medición'}
        </button>

        {existente && (
          <button type="button" className="enlace centrado peligro" onClick={borrar} disabled={guardando}>
            Borrar la medición de este día
          </button>
        )}
      </form>
    </section>
  );
}
