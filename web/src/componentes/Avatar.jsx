import { useColorDeSerie } from '../lib/paleta.js';

/**
 * Foto, emoji o iniciales, en ese orden de preferencia. El aro lleva el color
 * de la persona, el mismo que su línea en los gráficos.
 */
export default function Avatar({ perfil, tamano = 36, comoBoton = false, alPulsar }) {
  const adaptarColor = useColorDeSerie();
  const color = adaptarColor(perfil.color);
  const avatar = perfil.avatar || '';
  const esFoto = avatar.startsWith('data:image/');

  const estilo = {
    width: tamano,
    height: tamano,
    borderColor: color,
    fontSize: esFoto ? undefined : Math.round(tamano * 0.5)
  };

  const contenido = esFoto ? (
    <img src={avatar} alt="" />
  ) : avatar ? (
    <span aria-hidden="true">{avatar}</span>
  ) : (
    <span aria-hidden="true" style={{ color, fontSize: Math.round(tamano * 0.42) }}>
      {(perfil.nombre || perfil.usuario || '?').trim().charAt(0).toUpperCase()}
    </span>
  );

  if (!comoBoton) {
    return <span className="avatar" style={estilo}>{contenido}</span>;
  }

  return (
    <button
      type="button"
      className="avatar avatar-boton"
      style={estilo}
      onClick={alPulsar}
      aria-label={`Cambiar tu foto de perfil, ${perfil.nombre}`}
    >
      {contenido}
    </button>
  );
}
