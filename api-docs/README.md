# Documentación de la API — AhorrApp Backend

Documentación generada a partir del código real del backend (`src/controllers` + `src/routes`), verificada contra el schema de la base de datos corregido.

**Convenciones generales:**
- 🔒 = requiere header `Authorization: Bearer <token>` (JWT obtenido en `/api/auth/login`).
- 🔒👑 = requiere además rol `superuser`.
- 🔓 = endpoint público, sin autenticación.
- La gran mayoría de los endpoints responde `{ "ok": boolean, ... }`. Las excepciones puntuales (`dependientesController`, `exportController`, y las rutas de bolsa/noticias) están señaladas explícitamente dentro de cada documento porque usan otro formato (`{ error }` / `{ message }` / array plano).

## Índice

| # | Documento | Base path | Controller |
|---|---|---|---|
| 1 | [01-auth.md](01-auth.md) | `/api/auth` | `authController.js` |
| 2 | [02-categorias.md](02-categorias.md) | `/api/categorias` | `categoriasController.js` |
| 3 | [03-dependientes.md](03-dependientes.md) | `/api/dependientes` | `dependientesController.js` |
| 4 | [04-movimientos.md](04-movimientos.md) | `/api/movimientos` | `movimientosController.js` |
| 5 | [05-dashboard.md](05-dashboard.md) | `/api/dashboard` | `dashboardController.js` |
| 6 | [06-presupuestos.md](06-presupuestos.md) | `/api/presupuestos` | `PresupuestosController.js` |
| 7 | [07-fondo-emergencia.md](07-fondo-emergencia.md) | `/api/fondo-emergencia` | `fondoemergenciaController.js` |
| 8 | [08-reportes.md](08-reportes.md) | `/api/reportes` | `ReportesController.js` |
| 9 | [09-notificaciones.md](09-notificaciones.md) | `/api` (notificaciones y preferencias) | `Notificacionescontroller.js` |
| 10 | [10-export.md](10-export.md) | *(no montado: ver nota)* | `exportController.js` |
| 11 | [11-ai.md](11-ai.md) | `/api/ai` | `aiController.js` |
| 13 | [13-historial-sincronizacion.md](13-historial-sincronizacion.md) | `/api/historial` y `/api/movimientos/sincronizacion` | `Historialcontroller.js`, `sincronizacionController.js` |
| 12 | [12-bolsa-noticias-extra.md](12-bolsa-noticias-extra.md) *(bonus, sin controller propio)* | `/api` y `/api/noticias` | *(lógica inline en las rutas)* |

## Comportamiento común de la API (actualizado en la auditoría del 2026-11-04)

| Situación | Respuesta |
|---|---|
| Sin header `Authorization` | **401** `{ ok:false, mensaje:"Acceso denegado, token no proporcionado" }` |
| Token inválido o vencido | **401** `{ ok:false, mensaje:"Token inválido o expirado" }` *(antes 403; el web cierra sesión solo con 401)* |
| Rol insuficiente | **403** `{ ok:false, mensaje:"No tienes permisos para realizar esta acción" }` |
| Parámetro de ruta `:id` (o `:id_periodo`) que no es un entero positivo | **400** `{ ok:false, mensaje:"El parámetro 'id' debe ser un número entero positivo" }` *(antes 500 de PostgreSQL)* |
| JSON mal formado en el body | **400** `{ ok:false, mensaje:"El cuerpo de la petición no es un JSON válido" }` |
| Body demasiado grande | **413** |
| Ruta inexistente | **404** `{ ok:false, mensaje:"Ruta no encontrada: <MÉTODO> <url>" }` |
| Error no controlado | **500** `{ ok:false, mensaje:"Error interno del servidor" }` |

**CORS:** el backend acepta `localhost:5173` y los orígenes listados en la variable de entorno `CORS_ORIGINS` (separados por coma). El dominio de producción del frontend web debe agregarse ahí.

**Rutas de administración:** `GET /api/auth/PanelUsuarios`, `/api/auth/usuarios/PanelAdmin`, `/api/auth/dependientes/PanelAdmin` y `/api/auth/PanelDependientes` ahora exigen rol `admin` o `superuser` (antes solo token).

## Notas transversales

- **`dependientesController.js`** responde `{ error }` / `{ message }` en vez de `{ ok, mensaje }` (los errores de validación 400 incluyen ambos: `error` y `mensaje`), y `GET /api/dependientes` devuelve un array plano.
- **`exportController.js`** está **inactivo**: sus rutas están comentadas en `index.js` y el web las tiene deshabilitadas. Si se reactiva, la ruta lógica es `/api/exportar` (ver 10-export.md). Usa `camelCase` (`fechaInicio`/`fechaFin`) mientras que `ReportesController.js` usa `snake_case`.
- **`/api/ai/chat`** no exige token (decisión pendiente, ver `pendiente.md`). Ahora valida `messages` (400) y la configuración (503).
- **`PATCH /api/presupuestos/periodos/actualizar-ingreso`** ya está correctamente cableado (`actualizarIngresoRealHandler`): recalcula el ingreso real del período abierto. La advertencia anterior de "mal cableado" quedó obsoleta.
- **Notificaciones** se montan en la raíz `/api` (`/api/notificaciones`, `/api/preferencias-notificacion`, `/api/push-tokens`).
- **`POST /api/auth/google`** lo invoca la app móvil pero **no existe** en el backend (ver `pendiente.md`).
