import { useCallback, useEffect, useState } from 'react';

/**
 * Paleta categórica. El orden es el mecanismo de seguridad para daltonismo:
 * está elegido para que cualquier par contiguo se distinga también con
 * protanopia y deuteranopia. No lo reordenes sin volver a validarlo.
 *
 * El modo oscuro no es un "invertir": son los mismos ocho tonos re-escalonados
 * para la superficie oscura, y validados como conjunto contra ella.
 */
export const PALETA_CLARA = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100',
  '#e87ba4', '#008300', '#4a3aa7', '#e34948'
];

export const PALETA_OSCURA = [
  '#3987e5', '#d95926', '#199e70', '#c98500',
  '#d55181', '#008300', '#9085e9', '#e66767'
];

const EQUIVALENTES = new Map(
  PALETA_CLARA.map((claro, i) => [claro.toLowerCase(), PALETA_OSCURA[i]])
);

/** Traduce un color de serie al escalón que le toca en el modo actual. */
export function colorDeSerie(hex, oscuro) {
  if (!oscuro || !hex) return hex;
  return EQUIVALENTES.get(String(hex).toLowerCase()) ?? hex;
}

/** Sigue en vivo el ajuste del sistema: si cambia, el gráfico se repinta. */
export function useModoOscuro() {
  const [oscuro, setOscuro] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const consulta = window.matchMedia('(prefers-color-scheme: dark)');
    const alCambiar = (e) => setOscuro(e.matches);
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  return oscuro;
}

/** Devuelve una función que adapta cualquier color de perfil al modo actual. */
export function useColorDeSerie() {
  const oscuro = useModoOscuro();
  return useCallback((hex) => colorDeSerie(hex, oscuro), [oscuro]);
}
