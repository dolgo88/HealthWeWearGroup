/**
 * El logo de la app. Se sirve desde public/, así que la ruta se compone con
 * la base de la compilación: bajo GitHub Pages el sitio no cuelga de la raíz
 * del dominio y una ruta absoluta apuntaría fuera.
 */
export default function Marca({ tamano = 28, conNombre = true }) {
  return (
    <span className="marca">
      <img
        className="marca-logo"
        src={`${import.meta.env.BASE_URL}logo-limpio.png`}
        alt="HealthWeWear"
        width={tamano}
        height={tamano}
      />
      {conNombre && <span className="titulo">HealthWeWear</span>}
    </span>
  );
}
