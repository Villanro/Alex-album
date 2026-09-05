# Mi Álbum Mundial 2026

App local-first para controlar tu álbum Panini del Mundial 2026. El navegador es
la fuente de verdad: todo se guarda al instante en `localStorage` y funciona
entero sin conexión. Supabase es sólo una réplica en segundo plano para
sincronizar entre tus dispositivos.

## Qué archivos subir al servidor

Todo el contenido de esta carpeta **excepto** `supabase/` (esa carpeta sólo
tiene el SQL para ejecutar tú mismo, no se sirve). En concreto:

```
index.html
config.js          ← lo creas tú, ver siguiente sección
manifest.webmanifest
sw.js
css/
js/
fonts/
icons/
vendor/
```

Es un sitio 100% estático: cópialo por rsync o FTP a cualquier hosting con
HTTPS y ya funciona. No hay build ni `node_modules`.

## Crear config.js

`config.js` no está en el repositorio (mira `.gitignore`) porque cada persona
apunta a su propio proyecto de Supabase. Antes de subir la app:

1. Copia `config.example.js` a `config.js`.
2. Rellena `SUPABASE_URL` y `SUPABASE_ANON_KEY` con los valores de tu proyecto
   (Supabase → Project Settings → API → "Project URL" y "anon public" key).
3. Sube `config.js` junto al resto de archivos.

Si no creas `config.js` con valores reales, la app sigue funcionando
perfectamente en modo local; simplemente no sincroniza.

## SQL a ejecutar en Supabase

Abre el SQL Editor de tu proyecto y ejecuta el contenido de
[`supabase/schema.sql`](supabase/schema.sql). Crea la tabla `stickers` con
Row Level Security activada.

**No hay login ni email.** Cada dispositivo genera un código de sincronización
aleatorio la primera vez que se abre la app con `config.js` configurado (algo
como `AB3F-9KLM-22XZ`), lo guarda en `localStorage` y lo manda en la cabecera
HTTP `x-sync-code` en cada petición a Supabase. La política RLS de la tabla
sólo deja leer o escribir las filas cuyo `sync_code` coincide exactamente con
esa cabecera — sin el código correcto, la API no devuelve ni acepta nada.

Para compartir el álbum entre tu móvil y tu ordenador: abre Ajustes (⚙) en un
dispositivo, copia el código, y pégalo en Ajustes → "Vincular con otro
código…" del otro. Los dos álbumes se fusionan (nunca se borra nada). Como el
código es la única "llave" de tus datos, cópialo también en tu copia de
seguridad si quieres poder recuperarlo tras borrar el navegador.

## Por qué hace falta HTTPS

Dos piezas de la app dejan de funcionar (o el navegador las bloquea) fuera de
un contexto seguro:

- **Service worker** (`sw.js`): los navegadores sólo registran service workers
  en HTTPS (o en `localhost` durante el desarrollo). Sin él no hay caché
  offline ni instalación como PWA.
- **Portapapeles** (`navigator.clipboard`, usado en "Copiar para WhatsApp",
  "Copiar código" y en los respaldos): la API de escritura en portapapeles
  está restringida a contextos seguros.

## Subir la versión de caché al publicar cambios

Cada vez que subas cambios a `index.html`, `css/`, `js/` o cualquier estático,
sube el número de `CACHE_VERSION` al principio de [`sw.js`](sw.js):

```js
const CACHE_VERSION = 'panini2026-v2'; // era v1
```

Eso obliga al service worker a descartar la caché antigua y descargar los
archivos nuevos en cada dispositivo. Si no la subes, los usuarios que ya
tengan la app instalada pueden seguir viendo la versión anterior durante
bastante tiempo.

## Comprobaciones realizadas antes de la entrega

- **Total e integridad del catálogo**: 49 selecciones, 978 figuritas exactas
  (48 × 20 + FWC × 18), códigos únicos. Verificado con un script Node contra
  `js/data.js`.
- **Recorrido local completo** (marcar 3 figuritas de Colombia, repetir una
  dos veces más, bajar la repe desde Intercambio, recargar la página):
  probado de extremo a extremo en un navegador real contra un servidor
  estático local. Los datos sobreviven a la recarga y el conteo de repes baja
  a 0 sin perder la figurita como pegada.
- **Lógica de fusión y migraciones** (`js/store.js`): cubierta por un conjunto
  de pruebas automatizadas en Node — resolución de conflictos por
  `updated_at`, desempate por `count` mayor, adopción de filas remotas nuevas,
  deshacer, y migración desde los formatos antiguos `{MEX:{"3":1}}` (v1) y
  `{v:2,s:{},t:{}}` (v2, el propio prototipo).
- **Algoritmo de sincronización** (`js/sync.js`, función `diffRows`): cubierto
  por pruebas automatizadas que simulan exactamente los escenarios pedidos —
  primer sincronización con servidor vacío (sube todo, no borra nada),
  conflicto entre dos dispositivos offline (gana el cambio más reciente en
  ambos sentidos), y fusión sin pérdidas cuando cada lado tiene filas que el
  otro no tiene.
- **Aislamiento por código de sincronización, contra el proyecto de Supabase
  real**: probado en directo contra la API — con el código correcto se leen y
  escriben filas, con un código distinto o sin cabecera la API no devuelve
  nada (0 filas), confirmando que la política RLS aísla correctamente cada
  álbum.
- **Sincronización real de extremo a extremo**: se marcó una figurita en la
  app (sirviéndose por HTTP local) y se confirmó, consultando directamente la
  base de datos, que la fila llegó con el `sync_code`, `team`, `num` y
  `updated_at` correctos, sin ninguna acción de login de por medio.

## Decisión de diseño: "cola" de cambios offline

El encargo pedía encolar cambios mientras no hay red y vaciar la cola al
volver la conexión. Con como mucho 978 filas, se ha optado por un mecanismo
más simple y con el mismo resultado: en cada sincronización se descarga la
tabla completa y se compara figurita a figurita contra el estado local
(`diffRows`). Como el criterio de "quién gana" se basa en `updated_at`,
cualquier cambio hecho offline simplemente sigue siendo "más reciente" la
próxima vez que se intente sincronizar (al volver la red, al volver a primer
plano, o al reabrir la app), así que no hace falta persistir una cola aparte:
el propio estado local ya "recuerda" qué falta por subir. Si en el futuro
quieres una cola explícita (por ejemplo para reintentos con backoff más
finos), es un cambio localizado en `js/sync.js` sin tocar `store.js`.
