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

FONDO_POR_DEFECTO = (252, 252, 251)
SALIDA = Path(__file__).resolve().parent.parent / 'web' / 'public'


def color_de_fondo(imagen):
    """
    El color de fondo del logo, medido sobre todo su borde.

    Si el logo trae su propio fondo (un JPEG casi siempre lo trae), el lienzo
    tiene que usar ese mismo color, o se ve el borde del recorte como un
    recuadro dentro del icono. Se toma la mediana de una franja del contorno
    en vez de unas pocas esquinas: la compresión JPEG ensucia los píxeles
    sueltos, y cuatro muestras pueden caer todas en el mismo artefacto.
    """
    if imagen.mode == 'RGBA':
        return FONDO_POR_DEFECTO

    ancho, alto = imagen.size
    paso = max(1, min(ancho, alto) // 60)

    borde = []
    for x in range(0, ancho, paso):
        borde.append(imagen.getpixel((x, 0)))
        borde.append(imagen.getpixel((x, alto - 1)))
    for y in range(0, alto, paso):
        borde.append(imagen.getpixel((0, y)))
        borde.append(imagen.getpixel((ancho - 1, y)))

    canales = list(zip(*borde))
    mediana = tuple(sorted(c)[len(c) // 2] for c in canales)

    # Si el borde no es plano, el logo va a sangre y no hay fondo que imitar.
    disperso = any(sorted(c)[int(len(c) * 0.9)] - sorted(c)[int(len(c) * 0.1)] > 24 for c in canales)
    return FONDO_POR_DEFECTO if disperso else mediana


def recortar_fondo(imagen, fondo):
    """
    Convierte el fondo plano del logo en transparencia.

    Igualar el color del lienzo al del fondo no basta cuando el logo trae una
    viñeta —el centro más claro que los bordes—, porque siempre queda un
    rectángulo tenue. Volviéndolo transparente el problema desaparece, y de
    paso el logo sirve igual sobre fondo claro que oscuro.

    El corte es gradual: los píxeles muy parecidos al fondo desaparecen del
    todo, los muy distintos se mantienen opacos, y los intermedios —los bordes
    suavizados del dibujo— quedan a medias, que es lo que evita el borde
    dentado.
    """
    CERCA, LEJOS = 8, 30

    imagen = imagen.convert('RGB')
    pixeles = list(imagen.getdata())
    alfa = []
    for r, v, a in pixeles:
        distancia = max(abs(r - fondo[0]), abs(v - fondo[1]), abs(a - fondo[2]))
        if distancia <= CERCA:
            alfa.append(0)
        elif distancia >= LEJOS:
            alfa.append(255)
        else:
            alfa.append(round(255 * (distancia - CERCA) / (LEJOS - CERCA)))

    salida = imagen.convert('RGBA')
    salida.putalpha(Image.new('L', imagen.size).point(lambda _: 0))
    mascara = Image.new('L', imagen.size)
    mascara.putdata(alfa)
    salida.putalpha(mascara)
    return salida


def cuadrado(imagen, lado, margen, fondo):
    """Encaja el logo centrado en un lienzo cuadrado, dejando margen."""
    lienzo = Image.new('RGB', (lado, lado), fondo)

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

    fondo = color_de_fondo(logo)
    if logo.mode != 'RGBA' and fondo != FONDO_POR_DEFECTO:
        print(f'  fondo detectado rgb{fondo}: lo vuelvo transparente')
        logo = recortar_fondo(logo, fondo)
    fondo = FONDO_POR_DEFECTO

    # El logo sin fondo sirve también como marca dentro de la app.
    logo.save(SALIDA / 'logo-limpio.png', optimize=True)
    print('  logo-limpio.png')

    # 0.20 en el maskable: Android puede recortar hasta un 20% por lado.
    for nombre, lado, margen in [
        ('icono-192.png', 192, 0.06),
        ('icono-512.png', 512, 0.06),
        ('icono-maskable.png', 512, 0.20),
    ]:
        cuadrado(logo, lado, margen, fondo).save(SALIDA / nombre, optimize=True)
        print(f'  {nombre}')

    print(f'Iconos generados en {SALIDA}')


if __name__ == '__main__':
    main()
