# KnNi – Alianza Oficial

App web de la alianza: inscripciones a Cañón Storm / Desert Storm, sorteo de trenes, MVPs y poderes del batallón.

## Cómo funciona

- `index.html`: la página (lo que ven los jugadores).
- `netlify/functions/api.mjs`: el servidor (`/api`). Es lo único que habla con JSONBin y lo único que conoce la clave y la contraseña de admin.
- `sw.js` + `manifest.json`: permiten instalar la app en el celular.

La página **no contiene ninguna clave**. Todas las reglas (horarios de inscripción, duplicados, quién es admin) se verifican en el servidor.

## Configuración en Netlify

En **Site configuration → Environment variables** del sitio, crea estas variables:

| Variable | Valor |
|---|---|
| `JSONBIN_BIN_ID` | ID del bin de JSONBin (ej. `6aed9aa3ac6210605a71b12b`) |
| `JSONBIN_KEY` | Clave de JSONBin. Recomendado: una **Access Key** con permisos solo de *Read* y *Update* del bin |
| `JSONBIN_KEY_HEADER` | `X-Access-Key` si usas Access Key (si usas la Master Key, no hace falta crearla) |
| `ADMIN_PASSWORD` | Contraseña de administrador |
| `TOKEN_SECRET` | Texto largo y aleatorio (40+ caracteres). Sirve para firmar las sesiones de admin |

Después de crear o cambiar variables, ve a **Deploys → Trigger deploy** para que se apliquen.

- Para **cambiar la contraseña de admin**: cambia `ADMIN_PASSWORD` y vuelve a desplegar.
- Para **cerrar todas las sesiones de admin**: cambia `TOKEN_SECRET` y vuelve a desplegar.
