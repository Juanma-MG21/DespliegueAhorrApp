# API — Exportación de Datos (`exportController`)

> 🚫 **MÓDULO INACTIVO (2026-11-04):** `exportRoutes` está comentado en `index.js` (no hay ninguna ruta activa) y la página `exportar.jsx` está deshabilitada en el web. Esta documentación describe cómo se comportaría si se reactiva. Para reactivar: descomentar `app.use("/api/exportar", exportRoutes)` en `index.js`.

**Base path (si se reactiva):** `/api/exportar`
**Archivo de rutas:** `src/routes/exportRoutes.js`
**Archivo de controlador:** `src/controllers/exportController.js`

🔒 Todos los endpoints requieren `Authorization: Bearer <token>`.

> ⚠️ **Nota de nombre de ruta:** el propio archivo de rutas trae un comentario del equipo admitiendo que no se sabe por qué el path público quedó como `/api/exportar` en vez de `/api/exportar`. Funciona así en el código actual; si vas a consumirlo desde el frontend, usa `/api/exportar` tal cual.

> ⚠️ **Nota de formato:** a diferencia de casi todos los demás controladores (que responden `{ ok: boolean, mensaje }`), este controlador responde errores como `{ error: "..." }` y éxito como el array/objeto crudo o `{ message: "..." }`. Tenlo en cuenta si vas a consumir la API desde un cliente genérico.

Tipos válidos para el campo `tipo`: `"gastos"`, `"ingresos"`, `"movimientos"`, `"dependientes"`.
Formatos válidos para `formato`: `"json"`, `"csv"`, `"pdf"`.

---

## 1. 🔒 Crear una exportación

`POST /api/exportar`

Consulta los datos del tipo pedido para el usuario autenticado y, dentro de la misma transacción, deja un registro en la tabla `historial`.

### Body
```json
{
  "formato": "json",
  "tipo": "movimientos",
  "fechaInicio": "2026-01-01",
  "fechaFin": "2026-01-31"
}
```
> `formato` es obligatorio. `tipo` es opcional (por defecto `"movimientos"`). `fechaInicio`/`fechaFin` (camelCase) son opcionales y **solo aplican a `tipo: "ingresos"` o `"gastos"`** — para `"movimientos"` y `"dependientes"` no hay campo de fecha en la consulta y estos filtros se ignoran.

### Respuesta 200 — `formato: "json"`
Devuelve directamente el array de resultados (sin envolver en `{ ok, data }`), y fuerza la descarga con `Content-Disposition: attachment`:
```json
[
  { "id_movimiento": 1, "tipo_flujo": "Entrada", "subtipo_modulo": "Ingreso" },
  { "id_movimiento": 2, "tipo_flujo": "Salida", "subtipo_modulo": "Gasto" }
]
```

### Respuesta 200 — `formato: "csv"`
Devuelve un archivo CSV descargable (`Content-Type: text/csv`), no JSON.

### Respuesta 200 — `formato: "pdf"`
Devuelve un archivo PDF descargable (`Content-Type: application/pdf`), generado con `pdfkit`, con una tabla de los registros (oculta cualquier columna cuyo nombre contenga `password` o `token`, aunque ninguna de las consultas actuales trae esas columnas).

### Respuesta 401
```json
{ "error": "No hay usuario autenticado" }
```

### Respuesta 400
```json
{ "error": "Formato inválido. Use: json, csv o pdf" }
```
```json
{ "error": "Tipo inválido. Use: gastos, ingresos, movimientos o dependientes" }
```

### Respuesta 500
```json
{ "error": "Error interno al generar el reporte." }
```
> Antes de responder 500, el endpoint intenta registrar el fallo en `historial` con la acción `ERROR_EXPORTAR` (en una transacción aparte, best-effort).

---

## 2. 🔒 Listar historial de exportaciones

`GET /api/exportar?page=1&limit=20&tipo=movimientos&formato=json`

### Query params (todos opcionales)
- `page` — entero, default `1`.
- `limit` — entero, default `20`.
- `tipo` — filtra por el `tipo_reporte` guardado en el historial (coincidencia parcial vía `LIKE` sobre el JSON de detalles).
- `formato` — filtra por el `formato` guardado en el historial (misma lógica `LIKE`).

### Respuesta 200
Devuelve directamente el array de filas (sin envolver en `{ ok, data }`):
```json
[
  {
    "id_historial": 4,
    "accion": "EXPORTAR_REPORTE",
    "detalles": "{\"tipo_reporte\":\"movimientos\",\"formato\":\"json\",\"cantidad_registros\":2,\"filtros\":{\"fechaInicio\":null,\"fechaFin\":null},\"ruta_archivo\":\"/exports/reporte_financiero_2026-01-06.json\",\"IP\":\"::1\"}",
    "fecha": "2026-01-06T12:00:00.000Z"
  }
]
```
> `detalles` viaja como **string JSON** (no como objeto anidado) — hay que hacer `JSON.parse()` en el cliente si se necesita leer sus campos.

### Respuesta 401
```json
{ "error": "No hay usuario autenticado" }
```

### Respuesta 500
```json
{ "error": "Error interno al obtener exportaciones." }
```

---

## 3. 🔒 Eliminar un registro de exportación

`DELETE /api/exportar/:id`

Solo borra la entrada del **historial** de exportaciones (tabla `historial`); no borra los datos originales (movimientos, ingresos, etc.).

### Respuesta 200
```json
{ "message": "Exportación eliminada correctamente" }
```

### Respuesta 400
```json
{ "error": "ID de exportación inválido" }
```

### Respuesta 401
```json
{ "error": "No hay usuario autenticado" }
```

### Respuesta 404
```json
{ "error": "Exportación no encontrada o no pertenece al usuario" }
```

### Respuesta 500
```json
{ "error": "Error interno al eliminar exportación." }
```
