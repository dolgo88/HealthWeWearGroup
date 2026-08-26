import { useCallback, useEffect, useState } from 'react';
import { borrarSesion, guardarSesion, leerSesion, llamar, urlApi } from './lib/api.js';
import Configuracion from './componentes/Configuracion.jsx';
import Login from './componentes/Login.jsx';
import PanelComparar from './componentes/PanelComparar.jsx';
import PanelHoy from './componentes/PanelHoy.jsx';
import PanelProgreso from './componentes/PanelProgreso.jsx';

const PESTANAS = [
  { clave: 'hoy',      texto: 'Hoy',      icono: '＋' },
  { clave: 'progreso', texto: 'Progreso', icono: '◔' },
  { clave: 'comparar', texto: 'Comparar', icono: '⇅' }
];

export default function App() {
  const [hayUrl, setHayUrl] = useState(() => Boolean(urlApi()));
  const [sesion, setSesion] = useState(() => leerSesion());
  const [datos, setDatos] = useState(() => leerSesion()?.datos ?? null);
  const [pestana, setPestana] = useState('hoy');
  const [refrescando, setRefrescando] = useState(false);
  const [avisoGlobal, setAvisoGlobal] = useState(null);

  const salir = useCallback((mensaje) => {
    borrarSesion();
    setSesion(null);
    setDatos(null);
    setAvisoGlobal(mensaje ?? null);
  }, []);

  const alError = useCallback(
    (error) => {
      if (error.sesionCaducada) salir('Tu sesión ha caducado. Vuelve a entrar.');
      else setAvisoGlobal(error.message);
    },
    [salir]
  );

  const refrescar = useCallback(
    (nuevos) => {
      setDatos(nuevos);
      setSesion((actual) => {
        if (!actual) return actual;
        const actualizada = { ...actual, datos: nuevos };
        guardarSesion(actualizada);
        return actualizada;
      });
    },
    []
  );

  // Al abrir la app se recargan los datos: la hoja puede haber cambiado a mano.
  useEffect(() => {
    if (!sesion) return;
    let cancelado = false;
    setRefrescando(true);
    llamar('datos', { token: sesion.token })
      .then((r) => { if (!cancelado) refrescar(r.datos); })
      .catch((e) => { if (!cancelado) alError(e); })
      .finally(() => { if (!cancelado) setRefrescando(false); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion?.token]);

  if (!hayUrl) {
    return <Configuracion alGuardar={() => setHayUrl(true)} />;
  }

  if (!sesion || !datos) {
    return (
      <>
        {avisoGlobal && <p className="banda" role="alert">{avisoGlobal}</p>}
        <Login
          alEntrar={(respuesta) => {
            const nueva = { token: respuesta.token, usuario: respuesta.usuario, datos: respuesta.datos };
            guardarSesion(nueva);
            setAvisoGlobal(null);
            setDatos(respuesta.datos);
            setSesion(nueva);
            setPestana('hoy');
          }}
          alCambiarUrl={() => setHayUrl(false)}
        />
      </>
    );
  }

  return (
    <div className="app">
      <header className="barra-superior">
        <span className="marca-icono" aria-hidden="true">◗</span>
        <span className="titulo">HealthWeWear</span>
        <button className="enlace" onClick={() => salir()}>Salir</button>
      </header>

      {avisoGlobal && <p className="banda" role="alert">{avisoGlobal}</p>}

      {/* Mientras recarga, el contenido se atenúa: ni esqueletos ni saltos de layout */}
      <main className={refrescando ? 'contenido recargando' : 'contenido'}>
        {pestana === 'hoy' && (
          <PanelHoy sesion={sesion} datos={datos} alRefrescar={refrescar} alError={alError} />
        )}
        {pestana === 'progreso' && <PanelProgreso sesion={sesion} datos={datos} />}
        {pestana === 'comparar' && <PanelComparar sesion={sesion} datos={datos} />}
      </main>

      <nav className="barra-inferior" aria-label="Secciones">
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            className={pestana === p.clave ? 'activo' : ''}
            aria-current={pestana === p.clave ? 'page' : undefined}
            onClick={() => setPestana(p.clave)}
          >
            <span aria-hidden="true">{p.icono}</span>
            {p.texto}
          </button>
        ))}
      </nav>
    </div>
  );
}
