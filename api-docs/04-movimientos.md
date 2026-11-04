# API — Movimientos (`movimientosController`)

**Base path:** `/api/movimientos`
**Archivo de rutas:** `src/routes/movimientosRoutes.js`
**Archivo de controlador:** `src/controllers/movimientosController.js`

🔒 Todos los endpoints requieren `Authorization: Bearer <token>`.

Este es el módulo central de la app. Un **movimiento** es la tabla raíz (`tipo_flujo`: `Entrada`/`Salida`, `subtipo_modulo`: `Ingreso`/`Ahorro`/`Gasto`/`Deuda`/`Imprevisto`) de la que cuelgan las tablas de detalle: `ingresos`, `ahorros`, `gastos`, `imprevistos`, `deudas`.

---

## 1. 🔒 Crear movimiento (genérico)

`POST /api/movimientos`

Endpoint único para crear cualquier tipo de movimiento. El `subtipo_modulo` determina qué campos son válidos dentro de `datos`.

### Body — Ingreso
```json
{
  "tipo_flujo": "Entrada",
  "subtipo_modulo": "Ingreso",
  "datos": {
    "monto": 1000000,
    "descripcion": "Salario de enero",
    "fuente": "Trabajo",
    "fecha_registro": "2026-01-05",
    "id_categoria": 2
  }
}
```

### Body — Ahorro
```json
{
  "tipo_flujo": "Entrada",
  "subtipo_modulo": "Ahorro",
  "datos": {
    "monto": 500000,
    "descripcion": "Fondo para vacaciones",
    "meta": "Viaje a Cartagena",
    "fecha_registro": "2026-01-05",
    "fecha_meta": "2026-06-01",
    "id_categoria": 3
  }
}
```

### Body — Gasto
```json
{
  "tipo_flujo": "Salida",
  "subtipo_modulo": "Gasto",
  "datos": {
    "monto": 100000,
    "descripcion": "Mercado",
    "fecha_registro": "2026-01-05",
    "id_categoria": 1,
    "id_dependientes": 4
  }
}
```

### Body — Imprevisto
```json
{
  "tipo_flujo": "Salida",
  "subtipo_modulo": "Imprevisto",
  "datos": {
    "monto": 80000,
    "causa": "Reparación de la nevera",
    "fecha_registro": "2026-01-05",
    "id_categoria": 6,
    "id_dependientes": null
  }
}
```

### Body — Deuda
```json
{
  "tipo_flujo": "Salida",
  "subtipo_modulo": "Deuda",
  "datos": {
    "monto": 1200000,
    "fuente": "Tarjeta de crédito",
    "descripcion": "Compra de portátil",
    "cuotas_total": 12,
    "fecha_inicio": "2026-01-05",
    "fecha_fin": "2027-01-05",
    "id_categoria": 8
  }
}
```
> `fuente` es obligatorio para deudas. `monto` es obligatorio siempre (`datos.monto`).

### Respuesta 201
```json
{
  "ok": true,
  "mensaje": "Movimiento registrado exitosamente",
  "ID_movimiento": 10,
  "ID_detalle": 3
}
```

### Respuesta 400
```json
{ "ok": false, "mensaje": "El campo monto es requerido" }
```
```json
{ "ok": false, "mensaje": "tipo_flujo inválido" }
```
```json
{ "ok": false, "mensaje": "Subtipo inválido para Entrada" }
```
```json
{ "ok": false, "mensaje": "Subtipo inválido para Salida" }
```
```json
{ "ok": false, "mensaje": "La fuente de la deuda es requerida" }
```

---

## 2. 🔒 Listado unificado de todos los movimientos

`GET /api/movimientos`

Junta ingresos, gastos, deudas, ahorros e imprevistos en un solo array (pensado para alimentar al asistente de IA).

### Respuesta 200
```json
[
  { "tipo": "ingreso", "monto": 1000000, "descripcion": "Salario", "fecha": "2026-01-05T00:00:00.000Z" },
  { "tipo": "gasto", "monto": 100000, "descripcion": "Mercado", "fecha": "2026-01-05T00:00:00.000Z" },
  { "tipo": "deuda", "monto": 1200000, "descripcion": "Portátil", "estado": "pendiente", "fecha": "2027-01-05T00:00:00.000Z" },
  { "tipo": "ahorro", "monto": 500000, "descripcion": "Vacaciones", "fecha": "2026-01-05T00:00:00.000Z", "fecha_meta": "2026-06-01T00:00:00.000Z" },
  { "tipo": "imprevisto", "monto": 80000, "descripcion": "Reparación nevera", "fecha": "2026-01-05T00:00:00.000Z" }
]
```

### Respuesta 500
```json
{ "ok": false, "mensaje": "Error al recopilar movimientos" }
```

---

# Ingresos

## 3. 🔒 Listar ingresos

`GET /api/movimientos/ingresos`

### Respuesta 200
```json
[
  {
    "id": 5,
    "monto": 1000000,
    "descripcion": "Salario de enero",
    "fuente": "Trabajo",
    "fecha": "2026-01-05T00:00:00.000Z",
    "id_categoria": 2,
    "categoria": "Salario"
  }
]
```

## 4. 🔒 Actualizar ingreso

`PUT /api/movimientos/ingresos/:id`

### Body
```json
{
  "monto": 1050000,
  "descripcion": "Salario de enero + bono",
  "fuente": "Trabajo",
  "fecha_registro": "2026-01-05",
  "id_categoria": 2
}
```

### Respuesta 200
```json
{ "ok": true, "mensaje": "Ingreso actualizado exitosamente" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Ingreso no encontrado" }
```

## 5. 🔒 Eliminar ingreso

`DELETE /api/movimientos/ingresos/:id`

Borra en cascada: `ingresos` → `entrada` → `movimientos`.

### Respuesta 200
```json
{ "ok": true, "mensaje": "Ingreso eliminado exitosamente" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Ingreso no encontrado" }
```

---

# Ahorros

## 6. 🔒 Listar ahorros

`GET /api/movimientos/ahorros`

### Respuesta 200
```json
[
  {
    "id": 3,
    "monto": 500000,
    "monto_acumulado": 200000,
    "descripcion": "Fondo para vacaciones",
    "meta": "Viaje a Cartagena",
    "fecha": "2026-01-05T00:00:00.000Z",
    "fecha_meta": "2026-06-01T00:00:00.000Z",
    "id_categoria": 3,
    "categoria": "Viaje"
  }
]
```

## 7. 🔒 Actualizar ahorro

`PUT /api/movimientos/ahorros/:id`

### Body
```json
{
  "monto": 500000,
  "monto_acumulado": 250000,
  "descripcion": "Fondo para vacaciones",
  "meta": "Viaje a Cartagena",
  "fecha_registro": "2026-01-05",
  "fecha_meta": "2026-06-01",
  "id_categoria": 3
}
```

### Respuesta 200
```json
{ "ok": true, "mensaje": "Ahorro actualizado exitosamente" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Ahorro no encontrado" }
```

## 8. 🔒 Abonar a un ahorro

`PATCH /api/movimientos/ahorros/:id/abonar`

### Body
```json
{ "monto": 50000 }
```
> `monto` debe ser mayor a 0. Si el abono deja el ahorro con `monto_acumulado >= meta`, se dispara una notificación de "meta alcanzada".

### Respuesta 200
```json
{
  "ok": true,
  "mensaje": "Abono registrado correctamente",
  "acumulado": 300000,
  "meta": 500000,
  "progreso": 60,
  "meta_alcanzada": false
}
```

### Respuesta 400
```json
{ "ok": false, "mensaje": "El monto del abono debe ser mayor a 0" }
```
```json
{ "ok": false, "mensaje": "La meta de ahorro ya fue alcanzada" }
```
```json
{ "ok": false, "mensaje": "El aporte máximo permitido es <restante>" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Ahorro no encontrado" }
```

## 9. 🔒 Eliminar ahorro

`DELETE /api/movimientos/ahorros/:id`

### Respuesta 200
```json
{ "ok": true, "mensaje": "Ahorro eliminado exitosamente" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Ahorro no encontrado" }
```

---

# Gastos

## 10. 🔒 Listar gastos

`GET /api/movimientos/gastos`

### Respuesta 200
```json
[
  {
    "id": 10,
    "monto": 100000,
    "descripcion": "Mercado",
    "fecha": "2026-01-05T00:00:00.000Z",
    "id_categoria": 1,
    "id_dependientes": null,
    "categoria": "Alimentación",
    "dependiente": null
  }
]
```

## 11. 🔒 Actualizar gasto

`PUT /api/movimientos/gastos/:id`

### Body
```json
{
  "monto": 110000,
  "descripcion": "Mercado de la quincena",
  "fecha_registro": "2026-01-05",
  "id_categoria": 1,
  "id_dependientes": null
}
```

### Respuesta 200
```json
{ "ok": true, "mensaje": "Gasto actualizado exitosamente" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Gasto no encontrado" }
```

## 12. 🔒 Eliminar gasto

`DELETE /api/movimientos/gastos/:id`

### Respuesta 200
```json
{ "ok": true, "mensaje": "Gasto eliminado exitosamente" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Gasto no encontrado" }
```

---

# Imprevistos

## 13. 🔒 Listar imprevistos

`GET /api/movimientos/imprevistos`

### Respuesta 200
```json
[
  {
    "id": 6,
    "monto": 80000,
    "causa": "Reparación de la nevera",
    "fecha": "2026-01-05T00:00:00.000Z",
    "id_categoria": 6,
    "id_dependientes": null,
    "categoria": "Emergencias del hogar",
    "dependiente": null
  }
]
```

## 14. 🔒 Actualizar imprevisto

`PUT /api/movimientos/imprevistos/:id`

### Body
```json
{
  "monto": 90000,
  "causa": "Reparación de la nevera + repuesto",
  "fecha_registro": "2026-01-05",
  "id_categoria": 6,
  "id_dependientes": null
}
```

### Respuesta 200
```json
{ "ok": true, "mensaje": "Imprevisto actualizado exitosamente" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Imprevisto no encontrado o sin permisos" }
```

## 15. 🔒 Eliminar imprevisto

`DELETE /api/movimientos/imprevistos/:id`

### Respuesta 200
```json
{ "ok": true, "mensaje": "Imprevisto eliminado exitosamente" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Imprevisto no encontrado" }
```

---

# Deudas

## 16. 🔒 Listar deudas

`GET /api/movimientos/deudas`

### Respuesta 200
```json
[
  {
    "id": 2,
    "monto": 1200000,
    "fuente": "Tarjeta de crédito",
    "descripcion": "Compra de portátil",
    "cuotas_total": 12,
    "cuotas_pagadas": 1,
    "fecha_inicio": "2026-01-05T00:00:00.000Z",
    "fecha_fin": "2027-01-05T00:00:00.000Z",
    "estado": "pendiente",
    "id_categoria": 8,
    "categoria": "Tecnología"
  }
]
```
> `estado` es `'pendiente'` o `'pagada'`.

## 17. 🔒 Actualizar deuda

`PUT /api/movimientos/deudas/:id`

### Body
```json
{
  "monto": 1200000,
  "fuente": "Tarjeta de crédito",
  "descripcion": "Compra de portátil",
  "cuotas_total": 12,
  "cuotas_pagadas": 2,
  "fecha_inicio": "2026-01-05",
  "fecha_fin": "2027-01-05",
  "estado": "pendiente",
  "id_categoria": 8
}
```

### Respuesta 200
```json
{ "ok": true, "mensaje": "Deuda actualizada exitosamente" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Deuda no encontrada" }
```

## 18. 🔒 Abonar a una deuda (pagar cuota(s))

`PATCH /api/movimientos/deudas/:id/abonar`

### Body
```json
{
  "cuotas": 1,
  "descripcion": "Pago de enero"
}
```
> `cuotas` (opcional, entero, por defecto `1`, mínimo `1`) — número de cuotas que se están pagando de una vez. `descripcion` es opcional. El monto del abono se calcula automáticamente como `(monto_total / cuotas_total) * cuotas`. Solo funciona si la deuda tiene `cuotas_total` definido.

### Respuesta 200
```json
{
  "ok": true,
  "mensaje": "Cuota registrada",
  "cuotas_pagadas": 2,
  "cuotas_total": 12,
  "monto_abono": 100000,
  "estado": "pendiente"
}
```
> Cuando `cuotas_pagadas` llega a `cuotas_total`, `estado` pasa a `"pagada"` y `mensaje` cambia a `"Deuda pagada completamente"`.

### Respuesta 400
```json
{ "ok": false, "mensaje": "El número de cuotas debe ser >= 1" }
```
```json
{ "ok": false, "mensaje": "Quedan <n> cuota(s) por pagar." }
```
```json
{ "ok": false, "mensaje": "Esta deuda no tiene un número total de cuotas definido." }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Deuda no encontrada" }
```

### Respuesta 409 — ya está pagada
```json
{ "ok": false, "mensaje": "Esta deuda ya está pagada" }
```

## 19. 🔒 Eliminar deuda

`DELETE /api/movimientos/deudas/:id`

### Respuesta 200
```json
{ "ok": true, "mensaje": "Deuda eliminada exitosamente" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Deuda no encontrada" }
```

---

## Errores genéricos

```json
{ "ok": false, "mensaje": "Error interno del servidor" }
```
con status **500** ante cualquier excepción no controlada.

---

# Complementos (auditoría 2026-11-04)

## Idempotencia para la app móvil (`operation_id`) en `POST /api/movimientos`
Campo opcional `operation_id` (UUID v4) en el body, junto a `tipo_flujo`, `subtipo_modulo` y `datos`. Permite reintentar una creación sin duplicarla (modo sin conexión, RF-19).
- UUID mal formado → **400** `"operation_id inválido"`.
- Mismo UUID con datos distintos → **409** `"El identificador de operación ya se usó con otros datos."`.
- Mismo UUID y mismos datos → **200** con la respuesta original más `operation_id` y `repetido:true`.
- Sin `operation_id` (cliente web) el comportamiento no cambia.
Errores de validación de `POST /api/movimientos`: **400** (`datos` requerido, `monto` requerido, `tipo_flujo` ∈ {Entrada, Salida}, subtipo válido para el flujo).

## 🔒 Listar abonos de ahorros
`GET /api/movimientos/ahorros/abonos` → **200** `{ ok:true, datos:[{ id_abono, id_ahorros, monto, fecha_registro }] }` (más recientes primero).

## 🔒 Listar abonos de deudas
`GET /api/movimientos/deudas/abonos` → **200** `{ ok:true, datos:[{ id_abono_deuda, id_deudas, cuotas, monto, fecha_registro, descripcion }] }`.

## 🔒 Capacidades de sincronización
`GET /api/movimientos/sincronizacion` → **200** `{ ok:true, protocolo:1, idempotencia:true }`; **503** `{ ok:false, mensaje:"El servidor no pudo verificar la sincronización. Los pendientes se conservan." }`.

## 🔒 Consultar una operación sincronizada
`GET /api/movimientos/sincronizacion/operaciones/:operationId` (UUID v4).
**200** `{ ok:true, encontrado:boolean, resultado:object|null }` · **400** `"Identificador de operación inválido."` · **503** `"No se pudo consultar el estado de la operación."`.

## IDs
Todos los `:id` de este módulo deben ser enteros positivos (400 en caso contrario).
