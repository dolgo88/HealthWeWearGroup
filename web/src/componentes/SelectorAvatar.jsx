import { useRef, useState } from 'react';
import { llamar } from '../lib/api.js';
import { prepararAvatar } from '../lib/imagen.js';
import Avatar from './Avatar.jsx';

/* Una rejilla de partida para elegir con un toque. Quien quiera otro, lo pega
   desde el teclado de emojis de su móvil en el campo de abajo. */
const SUGERIDOS = [
  '💪', '🏃', '🚴', '🏋️', '🧘', '⚽', '🏀', '🎾', '🏊', '🥊',
  '🐢', '🐬', '🦊', '🦁', '🐼', '🐧', '🦉', '🐝', '🦖', '🐙',
  '🥑', '🥦', '🍉', '🍋', '🫐', '🌶️', '🍄', '🌰', '🥕', '🍏',
  '⭐', '🔥', '⚡', '🌈', '🌙', '☀️', '🌊', '🍀', '🎯', '🚀',
  '😀', '😎', '🤓', '🥳', '🙃', '😺', '👻', '🤖', '👽', '🦸'
];

/**
 * Hoja para elegir foto de perfil: una foto del móvil, un emoji sugerido,
 * o cualquier otro que se pegue a mano.
 */
export default function SelectorAvatar({ sesion, perfil, alGuardar, alCerrar, alError }) {
  const [pendiente, setPendiente] = useState(perfil.avatar || '');
  const [personalizado, setPersonalizado] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const entradaFichero = useRef(null);

  const vistaPrevia = { ...perfil, avatar: pendiente };

  async function elegirFoto(evento) {
    const fichero = evento.target.files?.[0];
    if (!fichero) return;
    setAviso(null);
    try {
      setPendiente(await prepararAvatar(fichero));
    } catch (err) {
      setAviso(err.message);
    } finally {
      // Permite volver a elegir el mismo fichero si hace falta.
      evento.target.value = '';
    }
  }

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    try {
      const r = await llamar('avatar', { token: sesion.token, avatar: pendiente });
      alGuardar(r.datos);
      alCerrar();
    } catch (err) {
      if (err.sesionCaducada) alError(err);
      else setAviso(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="velo" onClick={alCerrar}>
      <div
        className="hoja"
        role="dialog"
        aria-modal="true"
        aria-label="Elegir foto de perfil"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hoja-asa" aria-hidden="true" />
        <h3>Tu foto de perfil</h3>

        <div className="avatar-previa">
          <Avatar perfil={vistaPrevia} tamano={76} />
        </div>

        <div className="acciones-avatar">
          <button type="button" onClick={() => entradaFichero.current?.click()}>
            Subir una foto
          </button>
          <button type="button" onClick={() => setPendiente('')} disabled={!pendiente}>
            Quitar
          </button>
        </div>
        <input
          ref={entradaFichero}
          type="file"
          accept="image/*"
          hidden
          onChange={elegirFoto}
        />

        <p className="ayuda pequena">
          La foto se recorta en cuadrado y se reduce en tu móvil antes de subirla.
        </p>

        <h4>O elige un icono</h4>
        <div className="rejilla-emojis" role="group" aria-label="Iconos disponibles">
          {SUGERIDOS.map((e) => (
            <button
              key={e}
              type="button"
              className={pendiente === e ? 'emoji activo' : 'emoji'}
              aria-pressed={pendiente === e}
              onClick={() => setPendiente(e)}
            >
              {e}
            </button>
          ))}
        </div>

        <label htmlFor="otro-emoji">¿Otro? Pégalo aquí</label>
        <div className="fila-personalizado">
          <input
            id="otro-emoji"
            value={personalizado}
            onChange={(e) => setPersonalizado(e.target.value)}
            placeholder="🍕"
            maxLength={8}
          />
          <button
            type="button"
            onClick={() => { setPendiente(personalizado.trim()); setPersonalizado(''); }}
            disabled={!personalizado.trim()}
          >
            Usar
          </button>
        </div>

        {aviso && <p className="error" role="alert">{aviso}</p>}

        <button className="principal" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button className="enlace centrado" onClick={alCerrar}>Cancelar</button>
      </div>
    </div>
  );
}
