import { useState } from 'react';
import { llamar, urlFijadaEnCompilacion } from '../lib/api.js';

export default function Login({ alEntrar, alCambiarUrl }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const respuesta = await llamar('login', { usuario, password });
      alEntrar(respuesta);
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="pantalla-centro">
      <form className="tarjeta-formulario" onSubmit={enviar}>
        <div className="marca">
          <span className="marca-icono" aria-hidden="true">◗</span>
          <h1>HealthWeWear</h1>
        </div>
        <p className="ayuda">Entra con tu usuario para ver tu evolución y la del grupo.</p>

        <label htmlFor="usuario">Usuario</label>
        <input
          id="usuario"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
        />

        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <p className="error" role="alert">{error}</p>}

        <button type="submit" className="principal" disabled={cargando || !usuario || !password}>
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>

        {!urlFijadaEnCompilacion() && (
          <details className="ayuda-larga">
            <summary>Problemas para entrar</summary>
            <p>
              La app ya viene apuntando a la hoja del grupo. Sólo si te han dado
              otra dirección distinta hace falta cambiarla.
            </p>
            <button type="button" className="enlace" onClick={alCambiarUrl}>
              Cambiar la hoja conectada
            </button>
          </details>
        )}
      </form>
    </main>
  );
}
