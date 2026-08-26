# HealthWeWear

Seguimiento de peso en grupo. Cada persona entra con su usuario, registra su peso
diario y si ha hecho ejercicio, y ve su evolución, su IMC y su comparación con el
resto del grupo.

Los datos viven en una **hoja de Google Sheets** que puedes editar a mano cuando
quieras. No hay servidor que mantener ni base de datos que administrar.

---

## Cómo está montado

```
Hoja de cálculo  ──►  Apps Script  ──►  App web (React)
   los datos          la API, dentro     lo que ves en
   editables          de la propia hoja  el móvil
```

| Carpeta | Qué hay |
|---|---|
| `apps-script/` | El código que se pega dentro de la hoja de cálculo y hace de API. |
| `apps-script/pruebas/` | Banco de pruebas del backend, ejecutable en Node. |
| `web/` | La aplicación web: React + Vite, sin dependencias de gráficos. |
| `.github/workflows/` | Publicación automática en GitHub Pages. |

---

## Puesta en marcha

Son cuatro pasos. El único algo manual es el segundo, y se hace una sola vez.

### 1. La hoja de cálculo

Ya está creada en tu Drive:

**[HealthWeWear — Datos](https://docs.google.com/spreadsheets/d/1NUU0DCMl5NJVjk1iw8bqVlsvdYojDrQNPf2pfnWV0nk/edit)**

Está vacía a propósito: es el script del paso siguiente el que la construye, porque
así puede dejarte los desplegables de `SI`/`NO`, los formatos de fecha y los colores
condicionales ya puestos.

### 2. Instalar el script en la hoja

> **Importante:** entra al editor **desde la hoja**, con *Extensiones → Apps Script*.
> Si en su lugar creas un proyecto suelto en `script.google.com`, el script no
> queda asociado a ninguna hoja. Funciona igualmente —`ID_HOJA`, arriba de
> `Codigo.gs`, ya trae el ID de tu hoja— pero no tendrás el menú
> **HealthWeWear** dentro de la hoja y tendrás que lanzar las funciones desde
> el editor.

1. Abre la hoja y ve a **Extensiones → Apps Script**.
2. Borra el contenido de `Código.gs` y pega el de [`apps-script/Codigo.gs`](apps-script/Codigo.gs).
3. Pulsa el **+** junto a «Archivos», elige **Secuencia de comandos**, llámalo
   `Configurar` y pega dentro [`apps-script/Configurar.gs`](apps-script/Configurar.gs).
4. Guarda (💾).
5. Arriba, en el desplegable de funciones, elige **`configurar`** y pulsa **Ejecutar**.
   Google te pedirá permiso la primera vez: **Revisar permisos → tu cuenta →
   Configuración avanzada → Ir a (no seguro) → Permitir**. Es tu propio script
   pidiéndote acceso a tu propia hoja; ese aviso sale siempre con scripts sin
   verificar.
6. Vuelve a la hoja y **recárgala** (F5): ya tiene las pestañas **Usuarios**,
   **Mediciones** y **LEEME**, y arriba aparece el menú **HealthWeWear**.

Si algo no cuadra, ejecuta la función **`comprobar`** desde el editor y mira el
registro (**Ver → Registro**, o `Ctrl`+`Intro`). Te dice en una línea qué falta:
si el script está suelto o dentro de la hoja, qué pestañas hay, si las cabeceras
están bien y quién puede entrar.

### 3. Publicar el script como API

1. En el editor de Apps Script: **Implementar → Nueva implementación**.
2. Pulsa el engranaje ⚙ junto a «Seleccionar tipo» y elige **Aplicación web**.
3. Rellena:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
4. **Implementar** y copia la **URL de la aplicación web**. Acaba en `/exec`.

> **Sobre «Cualquier usuario»**: es necesario para que la app pueda hablar con el
> script sin obligar a cada persona a tener cuenta de Google. Nadie ve tus datos
> por tener la URL: el script sólo responde a quien envía un usuario y una
> contraseña válidos de la hoja.

### 4. Publicar la app

**Opción A — GitHub Pages (recomendada).**

1. En el repositorio: **Settings → Pages → Source: GitHub Actions**.
2. Fusiona esta rama en `main`. El workflow compila y publica solo.
3. La app queda en `https://dolgo88.github.io/HealthWeWearGroup/`.
4. La primera vez te pedirá la URL del paso 3. Se guarda en el móvil y no vuelve
   a preguntarla.

Si prefieres que la URL vaya ya dentro de la compilación y no se pida nunca,
créala como secreto: **Settings → Secrets and variables → Actions → New
repository secret**, nombre `VITE_API_URL`, valor tu URL `/exec`.

**Opción B — en local.**

```bash
cd web
npm install
npm run dev
```

### 5. Instalarla en el móvil

- **Android (Chrome)**: menú ⋮ → *Añadir a pantalla de inicio*.
- **iPhone (Safari)**: compartir → *Añadir a pantalla de inicio*.

Queda como una app más, con su icono y a pantalla completa.

---

## Dar de alta a las personas

En la pestaña **Usuarios** de la hoja, una fila por persona:

| Columna | Qué poner |
|---|---|
| `usuario` | Nombre de acceso, sin espacios. Al entrar no distingue mayúsculas. |
| `password` | Contraseña de acceso. |
| `nombre` | Nombre que se muestra en la app. |
| `sexo` | `M` o `F`. Se usa para el metabolismo basal. |
| `altura_cm` | Altura en cm, ej. `165`. Se usa para el IMC. |
| `fecha_nacimiento` | `AAAA-MM-DD`. Da la edad para el metabolismo basal. |
| `peso_objetivo_kg` | Opcional. Activa el bloque de objetivo y la fecha estimada. |
| `color` | Opcional, ej. `#2a78d6`. Vacío = color automático. |
| `activo` | `SI` o `NO`. Con `NO` se le quita el acceso sin borrar su historial. |

Las columnas se localizan **por el texto de su cabecera**, así que puedes
reordenarlas o insertar columnas propias sin romper nada. Lo que no debes cambiar
son los nombres de las hojas ni el texto de la fila 1.

El menú **HealthWeWear → Añadir filas de ejemplo** (dentro de la hoja) mete dos
personas y dos semanas de datos para que veas la app llena antes de empezar.

### Sobre las contraseñas

Están **en texto claro** en la hoja, que es lo que pediste para poder cambiarlas
a mano. Es razonable para un grupo de confianza, pero conviene saber lo que
implica:

- Quien tenga acceso de lectura a la hoja ve todas las contraseñas.
- Por eso: **que nadie reutilice aquí una contraseña que use en otro sitio**, y
  comparte la hoja sólo con quien la administra.
- Entre la app y el script sí viaja todo cifrado (HTTPS), y la sesión se mantiene
  con un token firmado de 30 días, no reenviando la contraseña en cada petición.

---

## Qué muestra la app

**Hoy** — Registro del día: peso, ejercicio (sí/no) y una nota. Arranca con tu
último peso conocido, así que normalmente sólo corriges décimas. Puedes registrar
días pasados y corregir o borrar cualquier día: una persona tiene como mucho una
medición por día, y volver a guardar la sobrescribe.

**Progreso** — Tu peso actual, la variación a 7 y 30 días, y:

- **IMC** con su categoría de la OMS y el rango de peso normal para tu altura.
- **Tendencia** en kg/semana por regresión lineal sobre los últimos 30 días, con
  el porcentaje de ajuste para que sepas si fiarte de ella.
- **Metabolismo basal** (Mifflin-St Jeor) y gasto diario estimado, ajustado por
  los días con ejercicio de las últimas dos semanas.
- **Racha de ejercicio**, mejor racha histórica, cambio total, mínimo y máximo.
- **Constancia**: proporción de días con ejercicio y de días que te has pesado.
- **Objetivo**: kg que faltan, progreso y fecha estimada de llegada al ritmo
  actual (sólo si tu tendencia va hacia el objetivo).
- Gráfico de evolución con la media móvil de 7 días y una franja que marca los
  días con ejercicio.

**Comparar** — Elige hasta 8 personas y superpón sus curvas. Dos modos:

- **Cambio %**: cada persona parte de 0 % al inicio del periodo. Es el modo
  correcto para comparar a gente con pesos de partida muy distintos.
- **Peso kg**: valores absolutos, útil si tenéis pesos parecidos.

Debajo, una tabla del grupo ordenada por quién más ha bajado en 30 días.

---

## Decisiones de diseño

**Nada de dobles ejes.** Comparar pesos muy distintos se resuelve indexando cada
serie a su propio inicio (el modo «Cambio %»), no metiendo dos escalas en un mismo
gráfico.

**Paleta validada para daltonismo.** Los ocho colores de serie y su orden están
elegidos para que cualquier par contiguo se distinga también con protanopia y
deuteranopia (ΔE ≥ 8 en OKLab). Por eso la comparación se corta en 8 personas:
más allá, ningún orden de colores aguanta. El modo oscuro no invierte los colores:
usa los mismos ocho tonos re-escalonados para fondo oscuro. Están en
[`web/src/lib/paleta.js`](web/src/lib/paleta.js).

**La identidad nunca depende sólo del color.** Siempre hay leyenda, etiquetas
directas cuando caben, y una vista de tabla con todos los valores.

**El gráfico no depende de librerías.** Es SVG escrito a mano
([`GraficoLineas.jsx`](web/src/componentes/GraficoLineas.jsx)): unos 250 KB menos
de JavaScript y control total sobre el comportamiento táctil.

**Escala Y sin cero.** Un gráfico de peso que empieza en 0 kg no deja ver nada.
Por eso tampoco hay relleno de área bajo la línea: sobre una base recortada,
sugiere magnitudes que no son.

---

## Mantenimiento

**Cambiar el código del script.** Edita en el editor de Apps Script y luego
**Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión →
Implementar**. Si creas una implementación nueva en vez de actualizar la
existente, la URL cambia y hay que volver a ponerla en la app.

**Cambiar la app.** Un push a `main` que toque `web/` republica sola.

**Probar el backend sin tocar la hoja.** `node apps-script/pruebas/simular.mjs`
ejecuta `Codigo.gs` y `Configurar.gs` en Node contra una hoja simulada y
comprueba el ciclo completo: creación de pestañas, login, guardado, corrección
del mismo día y borrado. Con `SUELTO=1` delante simula además el caso del script
creado fuera de la hoja.

**Problemas frecuentes**

| Síntoma | Causa |
|---|---|
| «La API devolvió algo que no es JSON» | La URL no acaba en `/exec`, o la implementación no está en «Cualquier usuario». |
| `configurar()` no aparece en el desplegable de funciones | Falta el fichero `Configurar.gs`. Son **dos** ficheros, no uno. |
| `configurar()` se ejecuta pero no aparece ninguna pestaña | El script está suelto y `ID_HOJA` no apunta a tu hoja. Ejecuta `comprobar` para verlo. |
| No sale el menú **HealthWeWear** en la hoja | Recarga la hoja (F5): `onOpen` sólo corre al abrirla. Si el script está suelto, no habrá menú nunca. |
| «Falta la hoja "Usuarios"» | No se ejecutó `configurar()`. Hazlo desde el menú **HealthWeWear** o desde el editor. |
| «Usuario o contraseña incorrectos» con datos correctos | Sobra un espacio en la celda, o `activo` está en `NO`. |
| La app no ve un cambio hecho a mano en la hoja | Los datos se recargan al abrir la app; ciérrala y vuelve a abrirla. |

---

## Aviso

El IMC y el metabolismo basal son estimaciones estadísticas de población. El IMC
no distingue músculo de grasa y no sirve de diagnóstico. Esta app es una
herramienta de seguimiento, no un consejo médico.
