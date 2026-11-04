# API — Categorías (`categoriasController`)

**Base path:** `/api/categorias`
**Archivo de rutas:** `src/routes/categoriasRoutes.js`
**Archivo de controlador:** `src/controllers/categoriasController.js`

🔒 Todos los endpoints de este módulo requieren `Authorization: Bearer <token>`.

Una categoría puede ser **global** (`es_global = true`, compartida por todos los usuarios, del sistema) o **propia del usuario** (`es_global = false`). Solo se pueden editar/deshabilitar/habilitar categorías propias.

---

## 1. 🔒 Listar categorías

`GET /api/categorias`

Devuelve las categorías globales + las propias del usuario autenticado.

### Respuesta 200
```json
{
  "ok": true,
  "categorias": [
    {
      "id": 1,
      "id_usuario": null,
      "nombre": "Alimentación",
      "descripcion": "Gastos de comida",
      "activa": true,
      "sistema": true,
      "es_global": true
    },
    {
      "id": 12,
      "id_usuario": 4,
      "nombre": "Suscripciones",
      "descripcion": null,
      "activa": true,
      "sistema": false,
      "es_global": false
    }
  ]
}
```

---

## 2. 🔒 Gastos agrupados por categoría

`GET /api/categorias/gastos`

### Respuesta 200
```json
{
  "ok": true,
  "categorias": [
    {
      "id": 1,
      "id_usuario": null,
      "nombre": "Alimentación",
      "descripcion": "Gastos de comida",
      "activa": true,
      "sistema": true,
      "es_global": true,
      "cantidad_gastos": 3,
      "total_gastos": 250000,
      "gastos": [
        {
          "id": 10,
          "id_categoria": 1,
          "monto": 100000,
          "descripcion": "Mercado",
          "fecha": "2026-01-05T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

---

## 3. 🔒 Ingresos agrupados por categoría

`GET /api/categorias/ingresos`

### Respuesta 200
```json
{
  "ok": true,
  "categorias": [
    {
      "id": 2,
      "id_usuario": null,
      "nombre": "Salario",
      "descripcion": null,
      "activa": true,
      "sistema": true,
      "es_global": true,
      "cantidad_ingresos": 1,
      "total_ingresos": 1000000,
      "ingresos": [
        {
          "id": 5,
          "id_categoria": 2,
          "monto": 1000000,
          "descripcion": "Salario",
          "fecha": "2026-01-05T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

---

## 4. 🔒 Ahorros agrupados por categoría

`GET /api/categorias/ahorros`

### Respuesta 200
Misma estructura que los anteriores, cambiando las claves por `cantidad_ahorros`, `total_ahorros`, `ahorros`.
```json
{
  "ok": true,
  "categorias": [
    {
      "id": 3,
      "nombre": "Viaje",
      "es_global": false,
      "cantidad_ahorros": 1,
      "total_ahorros": 500000,
      "ahorros": [
        { "id": 7, "id_categoria": 3, "monto": 500000, "descripcion": "Vuelos", "fecha": "2026-01-02T00:00:00.000Z" }
      ]
    }
  ]
}
```

---

## 5. 🔒 Imprevistos agrupados por categoría

`GET /api/categorias/imprevistos`

### Respuesta 200
Misma estructura, con `cantidad_imprevistos`, `total_imprevistos`, `imprevistos`.

---

## 6. 🔒 Deudas agrupadas por categoría

`GET /api/categorias/deudas`

### Respuesta 200
Misma estructura, con `cantidad_deudas`, `total_deudas`, `deudas`.

---

## 7. 🔒 Crear categoría

`POST /api/categorias`

### Body
```json
{
  "nombre": "Mascotas",
  "descripcion": "Gastos veterinarios y comida"
}
```
> `nombre` es obligatorio. `descripcion` es opcional. La categoría se crea siempre como propia del usuario (`es_global = false`, `sistema = false`, `activa = true`).

### Respuesta 201
```json
{
  "ok": true,
  "mensaje": "Categoria creada exitosamente",
  "id": 15
}
```

### Respuesta 400
```json
{ "ok": false, "mensaje": "El nombre es obligatorio" }
```

---

## 8. 🔒 Actualizar categoría

`PUT /api/categorias/:id`

### Params
- `id` (URL) — id de la categoría (debe ser propia del usuario, no global).

### Body
```json
{
  "nombre": "Mascotas y veterinaria",
  "descripcion": "Comida, vacunas y consultas"
}
```

### Respuesta 200
```json
{ "ok": true, "mensaje": "Categoria actualizada exitosamente" }
```

### Respuesta 403 — no es propietario o es una categoría global
```json
{ "ok": false, "mensaje": "No tienes permiso para editar esta categoria" }
```

### Respuesta 400
```json
{ "ok": false, "mensaje": "El nombre es obligatorio" }
```

---

## 9. 🔒 Deshabilitar categoría

`PATCH /api/categorias/:id/deshabilitar`

No requiere body. Pone `activa = FALSE`.

### Respuesta 200
```json
{ "ok": true, "mensaje": "Categoria deshabilitada" }
```

### Respuesta 403
```json
{ "ok": false, "mensaje": "No tienes permiso para deshabilitar esta categoria" }
```

---

## 10. 🔒 Habilitar categoría

`PATCH /api/categorias/:id/habilitar`

No requiere body. Pone `activa = TRUE`.

### Respuesta 200
```json
{ "ok": true, "mensaje": "Categoria habilitada" }
```

### Respuesta 403
```json
{ "ok": false, "mensaje": "No tienes permiso para habilitar esta categoria" }
```

---

## Errores genéricos

```json
{ "ok": false, "mensaje": "Error interno del servidor" }
```
con status **500** ante cualquier excepción no controlada.

## Eliminar categoría (complemento)
🔒 `DELETE /api/categorias/:id`
Solo categorías propias (no globales ni del sistema) y **previamente deshabilitadas**. Los registros que la usaban quedan sin categoría (FK `ON DELETE SET NULL`).
**200** `{ ok:true, mensaje:"Categoria eliminada" }` · **400** id no entero · **403** `"No tienes permiso para eliminar esta categoria"` · **409** `"Solo puedes eliminar categorías deshabilitadas"` o `"La categoría cambió; recarga e inténtalo nuevamente"` · **500**.
