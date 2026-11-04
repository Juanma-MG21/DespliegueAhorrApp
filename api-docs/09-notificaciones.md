# API — Notificaciones y Preferencias (`Notificacionescontroller`)

**Base path:** `/api` (el router se monta directo en la raíz de `/api`, no bajo `/api/notificaciones`)
**Archivo de rutas:** `src/routes/NotificacionesRoutes.js`
**Archivo de controlador:** `src/controllers/Notificacionescontroller.js`

🔒 Todos los endpoints requieren `Authorization: Bearer <token>` (aplicado con `router.use(verifyToken)` a nivel de router completo).

Tipos de notificación válidos (`TIPOS_NOTIFICACION`, definidos en `NotificacionesService.js`):
`"sistema"`, `"recordatorio"`, `"sugerencia"`, `"alerta_presupuesto"`.

---

## 1. 🔒 Listar notificaciones (paginado, con filtros)

`GET /api/notificaciones?leida=false&archivada=false&page=1&limit=20`

### Query params (todos opcionales)
- `leida` — `"true"` o `"false"`. Si se omite, no filtra por este campo.
- `archivada` — `"true"` o `"false"`. Si se omite, por defecto **solo muestra `archivada = false`**.
- `page` — entero, default `1`.
- `limit` — entero, default `20`, máximo `100`.

### Respuesta 200
```json
{
  "ok": true,
  "notificaciones": [
    {
      "id": 8,
      "tipo": "alerta_presupuesto",
      "entidad_tipo": "gasto",
      "entidad_id": 10,
      "mensaje": "Has usado el 90% de tu presupuesto de Gastos",
      "fecha": "2026-01-06T10:00:00.000Z",
      "leida": false,
      "archivada": false
    }
  ],
  "paginacion": { "page": 1, "limit": 20, "total": 1, "totalPaginas": 1 }
}
```

---

## 2. 🔒 Contador de no leídas

`GET /api/notificaciones/no-leidas/count`

### Respuesta 200
```json
{ "ok": true, "count": 3 }
```

---

## 3. 🔒 Marcar todas como leídas

`PATCH /api/notificaciones/leer-todas`

No requiere body.

### Respuesta 200
```json
{ "ok": true, "mensaje": "Todas las notificaciones marcadas como leídas" }
```

---

## 4. 🔒 Marcar una notificación como leída

`PATCH /api/notificaciones/:id/leer`

No requiere body.

### Respuesta 200
```json
{ "ok": true, "mensaje": "Notificación marcada como leída" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Notificación no encontrada" }
```

---

## 5. 🔒 Archivar una notificación

`PATCH /api/notificaciones/:id/archivar`

No requiere body.

### Respuesta 200
```json
{ "ok": true, "mensaje": "Notificación archivada" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Notificación no encontrada" }
```

---

## 6. 🔒 Eliminar una notificación

`DELETE /api/notificaciones/:id`

### Respuesta 200
```json
{ "ok": true, "mensaje": "Notificación eliminada" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Notificación no encontrada" }
```

---

## 7. 🔒 Obtener preferencias de notificación del usuario

`GET /api/preferencias-notificacion`

Devuelve las 4 preferencias posibles; las que el usuario no ha configurado explícitamente vienen `activa: true` por defecto.

### Respuesta 200
```json
{
  "ok": true,
  "preferencias": [
    { "tipo": "sistema", "activa": true },
    { "tipo": "recordatorio", "activa": true },
    { "tipo": "sugerencia", "activa": false },
    { "tipo": "alerta_presupuesto", "activa": true }
  ]
}
```

---

## 8. 🔒 Actualizar preferencias de notificación

`PUT /api/preferencias-notificacion`

### Body
```json
{
  "preferencias": [
    { "tipo": "sugerencia", "activa": false },
    { "tipo": "alerta_presupuesto", "activa": true }
  ]
}
```
> `preferencias` debe ser un array no vacío. Cada `tipo` debe ser uno de los 4 valores válidos. No es necesario enviar los 4 — solo se actualizan los incluidos.

### Respuesta 200
```json
{ "ok": true, "mensaje": "Preferencias actualizadas" }
```

### Respuesta 400
```json
{ "ok": false, "mensaje": "Debes enviar al menos una preferencia" }
```
```json
{ "ok": false, "mensaje": "Tipo de notificación inválido: <tipo>" }
```

---

## Errores genéricos

```json
{ "ok": false, "mensaje": "Error interno del servidor" }
```
con status **500** ante cualquier excepción no controlada.

## 9. 🔒 Registrar token push (FCM)
`POST /api/push-tokens`
```json
{ "fcm_token": "<token FCM>", "plataforma": "android" }
```
Guarda o reasigna el token al usuario autenticado (upsert por `fcm_token`). Requiere la tabla `push_tokens` (agregada a `SQL/supabase.sql` en la auditoría; sin ella respondía 500).
**200** `{ ok:true, mensaje:"Token registrado" }` · **400** `"fcm_token y plataforma son requeridos"` · **500**.

Nota: los `:id` de `/api/notificaciones/:id...` deben ser enteros positivos (400 en caso contrario).
