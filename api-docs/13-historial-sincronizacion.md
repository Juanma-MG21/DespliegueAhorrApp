# API — Historial (`Historialcontroller`)

**Base path:** `/api/historial` · Archivo de rutas: `src/routes/Historialroutes.js`

El historial guarda acciones (cuenta, dependientes). Las filas con `accion` que empieza por `RF19:` son internas de sincronización móvil y **no** se devuelven.

## 1. 🔒👑 Historial completo del sistema
`GET /api/historial` — rol `admin` o `superuser`.
**200**
```json
{ "ok": true, "historial": [
  { "id_historial": 1, "ID_usuario": 3, "usuario_nombre": "Ana", "usuario_apellido": "Pérez",
    "accion": "Eliminó un dependiente", "detalles": "Dependiente eliminado: ID 4", "fecha": "2026-10-26T12:00:00.000Z" } ] }
```
**403** sin rol · **500** `{ ok:false, mensaje:"Error al obtener el historial" }`.

## 2. 🔒 Mi historial
`GET /api/historial/propio` — cualquier usuario autenticado.
**200** `{ ok:true, historial:[{ id_historial, accion, detalles, fecha }] }` · **500** `"Error al obtener tu historial"`.

La sincronización móvil (`/api/movimientos/sincronizacion...`) está documentada en `04-movimientos.md`.
