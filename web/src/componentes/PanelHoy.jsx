import { useEffect, useState } from 'react';
import { llamar } from '../lib/api.js';
import { formatoLargo, formatoRelativo, hoyIso } from '../lib/fechas.js';
import { serieDe } from '../lib/metricas.js';

/** Registro diario: peso, si se ha hecho ejercicio y una nota opcional. */
export default function PanelHoy({ sesion, datos, alRefrescar, alError }) {
  const [fecha, setFecha] = useState(hoyIso());
  const [peso, setPeso] = useState('');
  const [ejercicio, setEjercicio] = useState(false);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

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
      alRefrescar(respuesta.datos);
      setAviso({
        tipo: 'ok',
        texto: respuesta.actualizado ? 'Medición actualizada.' : 'Medición guardada.'
      });
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
      alRefrescar(respuesta.datos);
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
        <h2>Hola, {sesion.usuario.nombre}</h2>
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

        {aviso && (
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
