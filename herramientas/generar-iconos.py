#!/usr/bin/env python3
"""
Genera el juego de iconos de la app a partir de un logo.

    pip install pillow
    python3 herramientas/generar-iconos.py web/public/logo.png

Deja en web/public/ los tres PNG que pide el manifiesto:

  icono-192.png       el de la pestaña y el atajo del móvil
  icono-512.png       el grande, para la pantalla de inicio
  icono-maskable.png  con margen extra, porque Android recorta el icono a
                      la forma que tenga configurada el usuario y se comería
                      los bordes del logo

El fondo se rellena con el color de superficie de la app en claro, para que
un logo con transparencia no salga sobre negro.
"""

import sys
from pathlib import Path

from PIL import Image

FONDO = (252, 252, 251)
SALIDA = Path(__file__).resolve().parent.parent / 'web' / 'public'


def cuadrado(imagen, lado, margen):
    """Encaja el logo centrado en un lienzo cuadrado, dejando margen."""
    lienzo = Image.new('RGB', (lado, lado), FONDO)

    util = int(lado * (1 - 2 * margen))
    copia = imagen.copy()
    copia.thumbnail((util, util), Image.LANCZOS)

    posicion = ((lado - copia.width) // 2, (lado - copia.height) // 2)
    # La máscara sólo existe si el original tiene transparencia.
    lienzo.paste(copia, posicion, copia if copia.mode == 'RGBA' else None)
    return lienzo


def main():
    if len(sys.argv) < 2:
        sys.exit('Uso: python3 herramientas/generar-iconos.py <ruta-del-logo>')

    origen = Path(sys.argv[1])
    if not origen.exists():
        sys.exit(f'No encuentro {origen}')

    logo = Image.open(origen)
    if logo.mode not in ('RGB', 'RGBA'):
        logo = logo.convert('RGBA')

    SALIDA.mkdir(parents=True, exist_ok=True)

    # 0.20 en el maskable: Android puede recortar hasta un 20% por lado.
    for nombre, lado, margen in [
        ('icono-192.png', 192, 0.06),
        ('icono-512.png', 512, 0.06),
        ('icono-maskable.png', 512, 0.20),
    ]:
        cuadrado(logo, lado, margen).save(SALIDA / nombre, optimize=True)
        print(f'  {nombre}')

    print(f'Iconos generados en {SALIDA}')


if __name__ == '__main__':
    main()
