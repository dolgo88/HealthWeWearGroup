import { useState } from 'react';
import { formatoCorto, formatoRelativo } from '../lib/fechas.js';
import { mediaMovil, recortarDesde, resumenDe } from '../lib/metricas.js';
import { useColorDeSerie } from '../lib/paleta.js';
import GraficoLineas from './GraficoLineas.jsx';
import TablaDatos from './TablaDatos.jsx';
import { Barra, Delta, Tarjeta } from './Tarjeta.jsx';

const RANGOS = [
  { clave: 30, texto: '30 días' },
  { clave: 90, texto: '90 días' },
  { clave: 365, texto: '1 año' },
  { clave: null, texto: 'Todo' }
];

export default function PanelProgreso({ sesion, datos }) {
  const [rango, setRango] = useState(90);
  const adaptarColor = useColorDeSerie();

  const perfil = datos.usuarios.find((u) => u.usuario === sesion.usuario.usuario) ?? sesion.usuario;
  const r = resumenDe(perfil, datos.mediciones);

  if (r.sinDatos) {
    return (
      <section className="panel">
        <h2>Tu progreso</h2>
        <p className="vacio">
          Cuando guardes tu primera medición en la pestaña <strong>Hoy</strong>, aquí
          aparecerán tu IMC, tu tendencia y el gráfico de evolución.
        </p>
      </section>
    );
  }

  const visible = recortarDesde(r.serie, rango, r.fechaActual);
  const series = [{ clave: perfil.usuario, nombre: perfil.nombre, color: perfil.color, puntos: visible }];
  const suavizada = visible.length >= 4 ? mediaMovil(visible, 7) : null;

  return (
    <section className="panel">
      <header className="panel-cabecera">
        <h2>Tu progreso</h2>
        <p className="ayuda">
          Última medición {formatoRelativo(r.fechaActual)}
          {r.diasDesdeUltima > 3 && ' — llevas unos días sin pesarte'}
        </p>
      </header>

      <div className="hero">
        <div>
          <div className="hero-valor">
            {r.pesoActual.toFixed(1)}<span className="hero-unidad">kg</span>
          </div>
          <div className="hero-pie">
            En 7 días <Delta valor={r.cambio7} /> · En 30 días <Delta valor={r.cambio30} />
          </div>
        </div>
      </div>

      <div className="filtros" role="group" aria-label="Rango de fechas del gráfico">
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

      <div className="bloque">
        <h3>Evolución del peso</h3>
        <GraficoLineas series={series} tendencia={suavizada} marcarEjercicio altura={250} />
        <p className="ayuda pequena">
          La línea llena es tu peso diario; la punteada, la media móvil de 7 días, que
          es la que conviene mirar porque ignora el ruido del día a día. La franja de
          rayitas bajo el eje marca los días en los que hiciste ejercicio.
        </p>
        <TablaDatos series={series} />
      </div>

      <h3>Tus números</h3>
      <div className="rejilla-tarjetas">
        <Tarjeta
          etiqueta="IMC"
          valor={r.imc ? r.imc.toFixed(1) : '—'}
          pie={r.categoriaImc?.etiqueta ?? 'Falta la altura en la hoja'}
          estado={r.categoriaImc?.estado}
        />
        <Tarjeta
          etiqueta="Tendencia"
          valor={r.tendencia ? (r.tendencia.kgPorSemana >= 0 ? '+' : '') + r.tendencia.kgPorSemana.toFixed(2) : '—'}
          unidad="kg/sem"
          pie={r.tendencia ? `ajuste ${(r.tendencia.r2 * 100).toFixed(0)}% sobre 30 días` : 'faltan datos'}
        />
        <Tarjeta
          etiqueta="Racha de ejercicio"
          valor={r.rachaEjercicio}
          unidad={r.rachaEjercicio === 1 ? 'día' : 'días'}
          pie={`tu mejor racha: ${r.mejorRacha}`}
        />
        <Tarjeta
          etiqueta="Cambio total"
          valor={(r.cambioTotal >= 0 ? '+' : '') + r.cambioTotal.toFixed(1)}
          unidad="kg"
          pie={`desde el ${formatoCorto(r.fechaInicial)}`}
        />
        <Tarjeta
          etiqueta="Mínimo registrado"
          valor={r.pesoMinimo.toFixed(1)}
          unidad="kg"
          pie={`máximo: ${r.pesoMaximo.toFixed(1)} kg`}
        />
        <Tarjeta
          etiqueta="Metabolismo basal"
          valor={r.tmb ? Math.round(r.tmb) : '—'}
          unidad="kcal"
          pie={
            r.gastoEstimado
              ? `gasto diario aprox. ${Math.round(r.gastoEstimado)} kcal`
              : 'falta la fecha de nacimiento'
          }
        />
      </div>

      <div className="bloque">
        <h3>Constancia</h3>
        <Barra
          proporcion={r.proporcionEjercicio}
          etiqueta={`Días con ejercicio (${r.diasEjercicio30} de ${r.diasRegistrados30} registrados)`}
          color={adaptarColor(perfil.color)}
        />
        <Barra
          proporcion={r.constancia}
          etiqueta={`Días que te has pesado en el último mes`}
          color={adaptarColor(perfil.color)}
        />
      </div>

      {r.objetivo && (
        <div className="bloque">
          <h3>Tu objetivo: {r.objetivo.meta.toFixed(1)} kg</h3>
          {r.objetivo.alcanzado ? (
            <p className="exito">Objetivo alcanzado. Ahora toca mantenerlo.</p>
          ) : (
            <>
              <Barra
                proporcion={progresoHaciaMeta(r)}
                etiqueta={`Te ${r.objetivo.restante > 0 ? 'quedan' : 'faltan'} ${Math.abs(r.objetivo.restante).toFixed(1)} kg`}
                color={adaptarColor(perfil.color)}
              />
              <p className="ayuda pequena">
                {r.objetivo.fechaEstimada
                  ? `Al ritmo de las últimas semanas llegarías alrededor del ${formatoCorto(r.objetivo.fechaEstimada)}.`
                  : 'Tu tendencia actual no va hacia el objetivo, así que no hay fecha estimada.'}
              </p>
            </>
          )}
        </div>
      )}

      {r.rangoSaludable && (
        <p className="ayuda">
          Para tu altura ({perfil.altura_cm} cm), el rango de peso con IMC normal va de{' '}
          <strong>{r.rangoSaludable.min.toFixed(1)} kg</strong> a{' '}
          <strong>{r.rangoSaludable.max.toFixed(1)} kg</strong>. El IMC es una referencia
          de población, no un diagnóstico: no distingue músculo de grasa.
        </p>
      )}
    </section>
  );
}

/** Cuánto del camino inicio → meta lleva recorrido. */
function progresoHaciaMeta(r) {
  const total = r.pesoInicial - r.objetivo.meta;
  if (Math.abs(total) < 0.01) return 1;
  return (r.pesoInicial - r.pesoActual) / total;
}
