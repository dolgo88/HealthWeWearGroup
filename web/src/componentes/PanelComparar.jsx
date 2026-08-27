import { useMemo, useState } from 'react';
import { recortarDesde, resumenDe, serieDe, serieRelativa } from '../lib/metricas.js';
import { useColorDeSerie } from '../lib/paleta.js';
import Avatar from './Avatar.jsx';
import GraficoLineas from './GraficoLineas.jsx';
import Leyenda from './Leyenda.jsx';
import TablaDatos from './TablaDatos.jsx';
import { Delta } from './Tarjeta.jsx';

const RANGOS = [
  { clave: 30, texto: '30 días' },
  { clave: 90, texto: '90 días' },
  { clave: 365, texto: '1 año' },
  { clave: null, texto: 'Todo' }
];

// El orden de la paleta es el mecanismo de seguridad para daltonismo:
// pasadas 8 series ningún orden aguanta, así que ahí se corta.
const MAXIMO_SERIES = 8;

export default function PanelComparar({ sesion, datos }) {
  const yo = sesion.usuario.usuario;
  const adaptarColor = useColorDeSerie();
  const [seleccion, setSeleccion] = useState(() => {
    const otro = datos.usuarios.find((u) => u.usuario !== yo);
    return otro ? [yo, otro.usuario] : [yo];
  });
  const [rango, setRango] = useState(90);
  const [modo, setModo] = useState('relativo'); // 'relativo' | 'absoluto'

  function alternar(usuario) {
    setSeleccion((actual) => {
      if (actual.includes(usuario)) {
        return actual.length > 1 ? actual.filter((u) => u !== usuario) : actual;
      }
      if (actual.length >= MAXIMO_SERIES) return actual;
      // Se mantiene el orden de la hoja para que el color de cada persona no baile.
      return datos.usuarios.map((u) => u.usuario).filter((u) => actual.includes(u) || u === usuario);
    });
  }

  const relativo = modo === 'relativo';

  const series = useMemo(
    () =>
      seleccion
        .map((clave) => {
          const perfil = datos.usuarios.find((u) => u.usuario === clave);
          if (!perfil) return null;
          const recortada = recortarDesde(serieDe(datos.mediciones, clave), rango);
          return {
            clave,
            nombre: perfil.nombre,
            color: perfil.color,
            puntos: relativo ? serieRelativa(recortada) : recortada
          };
        })
        .filter(Boolean)
        .filter((s) => s.puntos.length > 0),
    [seleccion, datos, rango, relativo]
  );

  const tabla = datos.usuarios
    .map((u) => resumenDe(u, datos.mediciones))
    .filter((r) => !r.sinDatos)
    .sort((a, b) => (a.cambio30 ?? 0) - (b.cambio30 ?? 0));

  return (
    <section className="panel">
      <header className="panel-cabecera">
        <h2>Comparar</h2>
        <p className="ayuda">Elige a quién quieres ver junto a ti.</p>
      </header>

      <div className="fichas" role="group" aria-label="Personas a comparar">
        {datos.usuarios.map((u) => {
          const activo = seleccion.includes(u.usuario);
          return (
            <button
              key={u.usuario}
              className={`ficha${activo ? ' activa' : ''}`}
              aria-pressed={activo}
              onClick={() => alternar(u.usuario)}
              style={activo ? { borderColor: adaptarColor(u.color), boxShadow: `inset 0 0 0 1px ${adaptarColor(u.color)}` } : undefined}
            >
              <Avatar perfil={u} tamano={24} />
              {u.nombre}
              {u.usuario === yo && <span className="atenuado"> (tú)</span>}
            </button>
          );
        })}
      </div>
      {seleccion.length >= MAXIMO_SERIES && (
        <p className="ayuda pequena">
          Máximo {MAXIMO_SERIES} personas a la vez: con más, los colores dejan de
          distinguirse con fiabilidad.
        </p>
      )}

      <div className="filtros" role="group" aria-label="Rango de fechas">
        {RANGOS.map((o) => (
          <button
            key={String(o.clave)}
            className={rango === o.clave ? 'activo' : ''}
            aria-pressed={rango === o.clave}
            onClick={() => setRango(o.clave)}
          >
            {o.texto}
          </button>
        ))}
      </div>

      <div className="filtros" role="group" aria-label="Qué se representa">
        <button
          className={relativo ? 'activo' : ''}
          aria-pressed={relativo}
          onClick={() => setModo('relativo')}
        >
          Cambio %
        </button>
        <button
          className={!relativo ? 'activo' : ''}
          aria-pressed={!relativo}
          onClick={() => setModo('absoluto')}
        >
          Peso kg
        </button>
      </div>

      <div className="bloque">
        <h3>{relativo ? 'Cambio desde el inicio del periodo' : 'Peso'}</h3>
        <GraficoLineas
          series={series}
          unidad={relativo ? '%' : 'kg'}
          decimales={relativo ? 1 : 1}
          altura={260}
        />
        <Leyenda series={series} />
        <p className="ayuda pequena">
          {relativo
            ? 'Cada persona parte de 0 % al inicio del periodo, así que la comparación es justa aunque partáis de pesos muy distintos.'
            : 'Peso absoluto en kilos. Útil si tenéis pesos parecidos; si no, el modo “Cambio %” compara mejor.'}
        </p>
        <TablaDatos series={series} unidad={relativo ? '%' : 'kg'} />
      </div>

      <div className="bloque">
        <h3>El grupo de un vistazo</h3>
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Persona</th>
                <th scope="col">Peso</th>
                <th scope="col">30 días</th>
                <th scope="col">IMC</th>
                <th scope="col">Ejercicio</th>
              </tr>
            </thead>
            <tbody>
              {tabla.map((r) => (
                <tr key={r.perfil.usuario} className={r.perfil.usuario === yo ? 'fila-propia' : undefined}>
                  <th scope="row">
                    <Avatar perfil={r.perfil} tamano={22} />
                    {r.perfil.nombre}
                  </th>
                  <td>{r.pesoActual.toFixed(1)}</td>
                  <td><Delta valor={r.cambio30} /></td>
                  <td>{r.imc ? r.imc.toFixed(1) : '—'}</td>
                  <td>{Math.round(r.proporcionEjercicio * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="nota-tabla">
            Ordenado por quien más ha bajado en los últimos 30 días. Ejercicio: proporción
            de días con ejercicio sobre los días registrados del último mes.
          </p>
        </div>
      </div>
    </section>
  );
}
