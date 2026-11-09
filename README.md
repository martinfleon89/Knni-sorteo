# KnNi – Alianza Oficial

App web de la alianza: inscripciones a Cañón Storm / Desert Storm, sorteo de trenes, MVPs y poderes del batallón.

## Cómo funciona

- `index.html`: la página (lo que ven los jugadores).
- `netlify/functions/api.mjs`: el servidor (`/api`). Valida todas las reglas (horarios, duplicados, quién es admin) y guarda los datos.
- Los datos se guardan en **Netlify Blobs**, el almacenamiento incluido en Netlify. No necesita ninguna clave.
- Cada guardado verifica que nadie haya guardado en el medio. Si dos personas se inscriben a la vez, se guardan las dos.
- Copia de seguridad automática: el primer estado de cada día queda guardado como `backup-AAAA-MM-DD` (en Netlify: **Blobs → store `knni`**).
- `sw.js` + `manifest.json`: permiten instalar la app en el celular.

## Configuración en Netlify

En **Site configuration → Environment variables** del sitio, crea:

| Variable | Valor |
|---|---|
| `ADMIN_PASSWORD` | Contraseña de administrador |
| `TOKEN_SECRET` | Texto largo y aleatorio (40+ caracteres). Sirve para firmar las sesiones |
| `MEMBER_PASSWORD` | *(Opcional)* Contraseña de la alianza para entrar a la app. No distingue mayúsculas. Si no existe, la app queda abierta |

Después de crear o cambiar variables, ve a **Deploys → Trigger deploy** para que se apliquen.

- Para **cambiar la contraseña de admin**: cambia `ADMIN_PASSWORD` y vuelve a desplegar.
- Para **cerrar todas las sesiones de admin**: cambia `TOKEN_SECRET` y vuelve a desplegar.
- **Contraseña de miembros**: cada miembro la escribe una vez y el celular la recuerda 30 días. Si la cambias (y vuelves a desplegar), todos deben escribir la nueva.

### Migración desde JSONBin (solo una vez)

Para traer los datos viejos, agrega también estas variables **antes** del primer despliegue:

| Variable | Valor |
|---|---|
| `JSONBIN_BIN_ID` | El ID del bin (aparece en la URL del bin en JSONBin) |
| `JSONBIN_KEY` | La clave de JSONBin |

La primera vez que alguien abra la app, el servidor copia todo desde JSONBin a Netlify Blobs. Si JSONBin no responde, no se crea nada y se vuelve a intentar en la siguiente visita. Una vez que la app muestra los datos, puedes **borrar estas dos variables y la cuenta de JSONBin**.

Mientras no existan datos en Netlify Blobs, la app en producción **no arranca vacía** si faltan estas variables (muestra un error de carga). Así se evita crear por error una base vacía. Para empezar desde cero a propósito, crea la variable `ALLOW_EMPTY_START` = `true`.

Las vistas previas de los Pull Requests usan un almacenamiento aparte (`knni-preview`), así que probarlas nunca toca los datos reales.

> Nota: cada sitio de Netlify tiene su propio almacenamiento. Si la alianza usa más de un sitio (por ejemplo `knni` y `trainknni`), cada uno tendrá datos separados.
