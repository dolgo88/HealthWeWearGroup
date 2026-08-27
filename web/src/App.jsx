import { useCallback, useEffect, useState } from 'react';
import { borrarSesion, guardarSesion, leerSesion, llamar, urlApi } from './lib/api.js';
import Avatar from './componentes/Avatar.jsx';
import Configuracion from './componentes/Configuracion.jsx';
import SelectorAvatar from './componentes/SelectorAvatar.jsx';
import Login from './componentes/Login.jsx';
import PanelComparar from './componentes/PanelComparar.jsx';
import PanelConstancia from './componentes/PanelConstancia.jsx';
import PanelHoy from './componentes/PanelHoy.jsx';
import PanelProgreso from './componentes/PanelProgreso.jsx';

const PESTANAS = [
  { clave: 'comparar',   texto: 'Grupo',      icono: '⇅' },
  { clave: 'hoy',        texto: 'Hoy',        icono: '＋' },
  { clave: 'progreso',   texto: 'Progreso',   icono: '◔' },
  { clave: 'constancia', texto: 'Constancia', icono: '✓' }
];

/* Al entrar se abre la comparación: lo primero es ver cómo va el grupo. */
const PESTANA_INICIAL = 'comparar';

export default function App() {
  // Sólo se pide la URL si alguien la ha borrado a mano: de fábrica ya viene.
  const [ajustandoUrl, setAjustandoUrl] = useState(() => !urlApi());
  const [sesion, setSesion] = useState(() => leerSesion());
  const [datos, setDatos] = useState(() => leerSesion()?.datos ?? null);
  const [pestana, setPestana] = useState(PESTANA_INICIAL);
  const [refrescando, setRefrescando] = useState(false);
  const [eligiendoAvatar, setEligiendoAvatar] = useState(false);
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

  /**
   * Guarda datos frescos y, si el servidor manda un token renovado, lo
   * sustituye: mientras se use la app, la sesión no llega a caducar.
   */
  const refrescar = useCallback((nuevos, tokenNuevo) => {
    setDatos(nuevos);
    setSesion((actual) => {
      if (!actual) return actual;
      const actualizada = { ...actual, datos: nuevos };
      if (tokenNuevo) actualizada.token = tokenNuevo;
      guardarSesion(actualizada);
      return actualizada;
    });
  }, []);

  // Al abrir la app se recargan los datos: la hoja puede haber cambiado a mano.
  useEffect(() => {
    if (!sesion) return;
    let cancelado = false;
    setRefrescando(true);
    llamar('datos', { token: sesion.token })
      .then((r) => { if (!cancelado) refrescar(r.datos, r.token); })
      .catch((e) => { if (!cancelado) alError(e); })
      .finally(() => { if (!cancelado) setRefrescando(false); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion?.token]);

  if (ajustandoUrl) {
    return <Configuracion alGuardar={() => setAjustandoUrl(false)} />;
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
            setPestana(PESTANA_INICIAL);
          }}
          alCambiarUrl={() => setAjustandoUrl(true)}
        />
      </>
    );
  }

  // El perfil se toma de los datos frescos: así el avatar recién cambiado
  // se ve al instante en toda la app.
  const perfil =
    datos.usuarios.find((u) => u.usuario === sesion.usuario.usuario) ?? sesion.usuario;

  return (
    <div className="app">
      <header className="barra-superior">
        <Avatar perfil={perfil} tamano={34} comoBoton alPulsar={() => setEligiendoAvatar(true)} />
        <span className="titulo">HealthWeWear</span>
        <button className="enlace" onClick={() => salir()}>Salir</button>
      </header>

      {eligiendoAvatar && (
        <SelectorAvatar
          sesion={sesion}
          perfil={perfil}
          alGuardar={refrescar}
          alCerrar={() => setEligiendoAvatar(false)}
          alError={alError}
        />
      )}

      {avisoGlobal && <p className="banda" role="alert">{avisoGlobal}</p>}

      {/* Mientras recarga, el contenido se atenúa: ni esqueletos ni saltos de layout */}
      <main className={refrescando ? 'contenido recargando' : 'contenido'}>
        {pestana === 'hoy' && (
          <PanelHoy sesion={sesion} datos={datos} alRefrescar={refrescar} alError={alError} />
        )}
        {pestana === 'progreso' && <PanelProgreso sesion={sesion} datos={datos} />}
        {pestana === 'comparar' && <PanelComparar sesion={sesion} datos={datos} />}
        {pestana === 'constancia' && <PanelConstancia sesion={sesion} datos={datos} />}
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
