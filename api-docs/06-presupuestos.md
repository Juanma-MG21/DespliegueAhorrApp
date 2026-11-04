# API — Presupuestos y Períodos (`PresupuestosController`)

**Base path:** `/api/presupuestos`
**Archivo de rutas:** `src/routes/PresupuestosRoutes.js`
**Archivo de controlador:** `src/controllers/PresupuestosController.js`

🔒 Todos los endpoints requieren `Authorization: Bearer <token>`.

Este módulo maneja dos conceptos distintos:
- **Perfil de presupuesto** (tabla `presupuestos`): una plantilla reutilizable con porcentajes de distribución (gastos/deudas/imprevistos/ahorros/emergencia, deben sumar 100%) y un día de corte. Un usuario puede tener varios perfiles, pero solo uno **activo** a la vez.
- **Período** (tabla `periodos_presupuesto`): una instancia concreta del perfil activo, abierta con un ingreso estimado, con fecha de inicio/fin calculada según el día de corte. Solo puede haber un período **abierto** por usuario a la vez.

> ⚠️ Nota de implementación: la ruta `PATCH /periodos/actualizar-ingreso` está conectada a la función `actualizarIngresoReal`, que internamente espera `(ID_usuario, connection)` en vez de `(req, res)` — está pensada como helper interno (se usa desde `movimientosController` tras registrar un ingreso), no como handler de Express. Tal como está cableada hoy, llamarla como endpoint HTTP fallará. Repórtalo si necesitas ese endpoint funcional.

---

# Perfiles de presupuesto

## 1. 🔒 Listar perfiles del usuario

`GET /api/presupuestos`

### Respuesta 200
```json
{
  "ok": true,
  "data": [
    {
      "ID_presupuesto": 1,
      "Nombre": "Mi presupuesto",
      "Descripcion": null,
      "Activo": true,
      "Dia_corte": 1,
      "Porcentaje_gastos": 40,
      "Porcentaje_deudas": 20,
      "Porcentaje_imprevistos": 15,
      "Porcentaje_ahorros": 10,
      "Porcentaje_emergencia": 15,
      "Fecha_actualizacion": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

## 2. 🔒 Obtener un perfil específico

`GET /api/presupuestos/:id`

### Respuesta 200
```json
{
  "ok": true,
  "data": {
    "ID_presupuesto": 1,
    "ID_usuario": 4,
    "Nombre": "Mi presupuesto",
    "Descripcion": null,
    "Activo": true,
    "Dia_corte": 1,
    "Porcentaje_gastos": 40,
    "Porcentaje_deudas": 20,
    "Porcentaje_imprevistos": 15,
    "Porcentaje_ahorros": 10,
    "Porcentaje_emergencia": 15,
    "Fecha_actualizacion": "2026-01-01T00:00:00.000Z"
  }
}
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Perfil no encontrado" }
```

## 3. 🔒 Crear perfil

`POST /api/presupuestos`

### Body
```json
{
  "Nombre": "Mi presupuesto",
  "Descripcion": "Distribución mensual estándar",
  "Dia_corte": 1,
  "Porcentaje_gastos": 40,
  "Porcentaje_deudas": 20,
  "Porcentaje_imprevistos": 15,
  "Porcentaje_ahorros": 10,
  "Porcentaje_emergencia": 15
}
```
> Todos los campos son opcionales (tienen valores por defecto — ver arriba). Los 5 porcentajes deben sumar exactamente 100. `Dia_corte` debe estar entre 1 y 31. El perfil se crea siempre **inactivo** (`Activo: false`); hay que activarlo con el endpoint 6.

### Respuesta 201
```json
{ "ok": true, "mensaje": "Perfil creado", "ID_presupuesto": 3 }
```

### Respuesta 400
```json
{ "ok": false, "mensaje": "Los porcentajes deben sumar 100. Suma actual: 95.00" }
```
```json
{ "ok": false, "mensaje": "El día de corte debe estar entre 1 y 31" }
```

## 4. 🔒 Editar perfil

`PUT /api/presupuestos/:id`

No se puede editar un perfil que tiene un período abierto asociado.

### Body (todos los campos opcionales, se actualiza solo lo enviado)
```json
{
  "Nombre": "Presupuesto ajustado",
  "Porcentaje_gastos": 35,
  "Porcentaje_deudas": 20,
  "Porcentaje_imprevistos": 15,
  "Porcentaje_ahorros": 15,
  "Porcentaje_emergencia": 15
}
```
> Si envías cualquiera de los porcentajes, la validación exige que **los 5** estén presentes en el body y sumen 100 (los que falten se toman como 0 para la suma).

### Respuesta 200
```json
{ "ok": true, "mensaje": "Perfil actualizado" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Perfil no encontrado" }
```

### Respuesta 409 — tiene un período abierto
```json
{ "ok": false, "mensaje": "No puedes editar un perfil con un período activo. Cierra el período primero." }
```

### Respuesta 400
```json
{ "ok": false, "mensaje": "El día de corte debe estar entre 1 y 31" }
```
```json
{ "ok": false, "mensaje": "Los porcentajes deben sumar 100. Suma actual: <n>" }
```

## 5. 🔒 Eliminar perfil

`DELETE /api/presupuestos/:id`

No se puede eliminar el perfil activo ni uno que ya tenga períodos registrados (histórico).

### Respuesta 200
```json
{ "ok": true, "mensaje": "Perfil eliminado" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Perfil no encontrado" }
```

### Respuesta 409
```json
{ "ok": false, "mensaje": "No puedes eliminar el perfil activo" }
```
```json
{ "ok": false, "mensaje": "El perfil tiene períodos registrados y no puede eliminarse" }
```

## 6. 🔒 Activar perfil

`PUT /api/presupuestos/:id/activar`

Desactiva cualquier otro perfil del usuario y activa este. No se puede cambiar de perfil si hay un período abierto.

### Respuesta 200
```json
{ "ok": true, "mensaje": "Perfil activado correctamente" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "Perfil no encontrado" }
```

### Respuesta 409
```json
{ "ok": false, "mensaje": "Tienes un período activo. Ciérralo antes de cambiar de perfil." }
```

---

# Períodos

## 7. 🔒 Abrir un período

`POST /api/presupuestos/periodos/abrir`

Requiere tener un perfil activo y no tener ya un período abierto. Calcula automáticamente `fecha_inicio` (hoy), `fecha_fin` (según `Dia_corte` del perfil activo) y los montos de cada categoría (según los porcentajes del perfil).

### Body
```json
{ "ingreso_estimado": 1000000 }
```

### Respuesta 201
```json
{
  "ok": true,
  "mensaje": "Período abierto correctamente",
  "data": {
    "ID_periodo": 7,
    "Fecha_inicio": "2026-01-05",
    "Fecha_fin": "2026-02-04",
    "Saldo_anterior": 0,
    "Ingreso_estimado": 1000000,
    "Monto_gastos": 400000,
    "Monto_deudas": 200000,
    "Monto_imprevistos": 150000,
    "Monto_ahorros": 100000,
    "Monto_emergencia": 150000
  }
}
```

### Respuesta 400
```json
{ "ok": false, "mensaje": "ingreso_estimado es requerido y debe ser >= 0" }
```
```json
{ "ok": false, "mensaje": "No tienes un perfil de presupuesto activo. Activa uno primero." }
```

### Respuesta 409
```json
{ "ok": false, "mensaje": "Ya tienes un período abierto. Ciérralo antes de abrir uno nuevo." }
```

## 8. 🔒 Cerrar el período activo

`PUT /api/presupuestos/periodos/cerrar`

No requiere body. Calcula el ingreso real acumulado en el período y lo marca como `'cerrado'`. Al cerrar, dispara una verificación interna que sugiere redirigir a ahorros el dinero de "imprevistos" no usado.

### Respuesta 200
```json
{
  "ok": true,
  "mensaje": "Período cerrado correctamente",
  "data": {
    "ID_periodo": 7,
    "Ingreso_real": 1000000,
    "Fecha_inicio": "2026-01-05",
    "Fecha_fin": "2026-02-04"
  }
}
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "No tienes un período abierto." }
```

## 9. 🔒 Listar períodos (histórico paginado)

`GET /api/presupuestos/periodos?pagina=1&limite=10`

### Query params
- `pagina` (opcional, default `1`)
- `limite` (opcional, default `10`, máximo `50`)

### Respuesta 200
```json
{
  "ok": true,
  "data": [
    {
      "ID_periodo": 7,
      "ID_presupuesto": 1,
      "ID_usuario": 4,
      "Fecha_inicio": "2026-01-05T00:00:00.000Z",
      "Fecha_fin": "2026-02-04T00:00:00.000Z",
      "Ingreso_estimado": 1000000,
      "Ingreso_real": 1000000,
      "Saldo_anterior": 0,
      "Estado": "abierto",
      "Monto_gastos": 400000,
      "Monto_deudas": 200000,
      "Monto_imprevistos": 150000,
      "Monto_ahorros": 100000,
      "Monto_emergencia": 150000,
      "Perfil_nombre": "Mi presupuesto"
    }
  ],
  "total": 1,
  "pagina": 1,
  "limite": 10
}
```

## 10. 🔒 Obtener el período activo (con ejecución en tiempo real)

`GET /api/presupuestos/periodos/activo`

### Respuesta 200 — con período abierto
```json
{
  "ok": true,
  "data": {
    "ID_periodo": 7,
    "ID_presupuesto": 1,
    "ID_usuario": 4,
    "Fecha_inicio": "2026-01-05T00:00:00.000Z",
    "Fecha_fin": "2026-02-04T00:00:00.000Z",
    "Ingreso_estimado": 1000000,
    "Ingreso_real": 1000000,
    "Saldo_anterior": 0,
    "Estado": "abierto",
    "Monto_gastos": 400000,
    "Monto_deudas": 200000,
    "Monto_imprevistos": 150000,
    "Monto_ahorros": 100000,
    "Monto_emergencia": 150000,
    "Perfil_nombre": "Mi presupuesto",
    "Dia_corte": 1,
    "ejecucion": {
      "gastos":      { "presupuestado": 400000, "ejecutado": 100000, "disponible": 300000 },
      "deudas":      { "presupuestado": 200000, "ejecutado": 100000, "disponible": 100000 },
      "imprevistos": { "presupuestado": 150000, "ejecutado": 0,      "disponible": 150000 },
      "ahorros":     { "presupuestado": 100000, "ejecutado": 50000,  "disponible": 50000  }
    }
  }
}
```

### Respuesta 200 — sin período abierto
```json
{ "ok": true, "data": null }
```

## 11. 🔒 Ajustar el ingreso estimado del período activo

`PATCH /api/presupuestos/periodos/ajustar-ingreso`

Recalcula todos los montos por categoría con el nuevo ingreso.

### Body
```json
{ "ingreso_estimado": 1200000 }
```

### Respuesta 200
```json
{
  "ok": true,
  "mensaje": "Ingreso ajustado y montos recalculados",
  "data": {
    "Ingreso_estimado": 1200000,
    "Saldo_anterior": 0,
    "Monto_gastos": 480000,
    "Monto_deudas": 240000,
    "Monto_imprevistos": 180000,
    "Monto_ahorros": 120000,
    "Monto_emergencia": 180000
  }
}
```

### Respuesta 400
```json
{ "ok": false, "mensaje": "ingreso_estimado debe ser >= 0" }
```

### Respuesta 404
```json
{ "ok": false, "mensaje": "No hay período activo" }
```

## 12. 🔒 Recalcular ingreso real del período abierto

`PATCH /api/presupuestos/periodos/actualizar-ingreso`

Handler HTTP (`actualizarIngresoRealHandler`) que invoca a `actualizarIngresoReal(ID_usuario)`: suma los ingresos del usuario dentro del rango del período abierto y actualiza `ingreso_real`. Sin body. Si no hay período abierto no hace nada. El backend también lo ejecuta solo al crear, editar o eliminar un ingreso.

### Respuesta 200
```json
{ "ok": true, "mensaje": "Ingreso real actualizado correctamente" }
```

### Respuesta 500
`{ ok:false, mensaje:"Error al actualizar ingreso real" }`

---

## Errores genéricos

La mayoría de los endpoints de este controlador devuelven, ante error interno:
```json
{ "ok": false, "mensaje": "<mensaje del error>", "error": "<detalle técnico>" }
```
con status **500**. (Algunos, como `abrirPeriodo`, omiten el campo `error` y solo devuelven `mensaje: "Error interno del servidor"`.)
