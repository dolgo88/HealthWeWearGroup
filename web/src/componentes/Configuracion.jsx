import { useState } from 'react';
import { guardarUrlApi, llamar } from '../lib/api.js';

/**
 * Pantalla inicial cuando la app aún no sabe con qué hoja hablar.
 * Sólo aparece si no se compiló con VITE_API_URL.
 */
export default function Configuracion({ alGuardar }) {
  const [url, setUrl] = useState('');
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);

  async function probar(evento) {
    evento.preventDefault();
    setError(null);
    setEstado('probando');

    const limpia = url.trim();
    if (!/^https:\/\/script\.google\.com\/.*\/exec$/.test(limpia)) {
      setError('La URL debe empezar por https://script.google.com/ y terminar en /exec');
      setEstado(null);
      return;
    }

    guardarUrlApi(limpia);
    try {
      await llamar('ping');
      setEstado('ok');
      alGuardar();
    } catch (err) {
      setError(err.message);
      setEstado(null);
    }
  }

  return (
    <main className="pantalla-centro">
      <form className="tarjeta-formulario" onSubmit={probar}>
        <h1>Conectar con tu hoja</h1>
        <p className="ayuda">
          Pega aquí la URL de la aplicación web que publicaste desde Apps Script.
          Se guarda sólo en este dispositivo.
        </p>

        <label htmlFor="url">URL de la API</label>
        <input
          id="url"
          type="url"
          inputMode="url"
          placeholder="https://script.google.com/macros/s/…/exec"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoComplete="off"
          required
        />

        {error && <p className="error" role="alert">{error}</p>}

        <button type="submit" className="principal" disabled={estado === 'probando'}>
          {estado === 'probando' ? 'Comprobando…' : 'Conectar'}
        </button>

        <details className="ayuda-larga">
          <summary>¿De dónde saco esa URL?</summary>
          <ol>
            <li>Abre la hoja de cálculo y ve a <strong>Extensiones → Apps Script</strong>.</li>
            <li>Pulsa <strong>Implementar → Nueva implementación</strong>.</li>
            <li>Tipo: <strong>Aplicación web</strong>. Ejecutar como <strong>Yo</strong>, acceso <strong>Cualquier usuario</strong>.</li>
            <li>Copia la URL que acaba en <code>/exec</code>.</li>
          </ol>
        </details>
      </form>
    </main>
  );
}
