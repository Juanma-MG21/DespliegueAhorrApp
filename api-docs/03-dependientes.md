# API — Dependientes (`dependientesController`)

**Base path:** `/api/dependientes`
**Archivo de rutas:** `src/routes/dependientesRoutes.js`
**Archivo de controlador:** `src/controllers/dependientesController.js`

🔒 Todos los endpoints requieren `Authorization: Bearer <token>`.

Un "dependiente" es una persona a cargo del usuario (hijo, familiar, etc.) que puede asociarse a gastos e imprevistos.

---

## 1. 🔒 Listar dependientes del usuario

`GET /api/dependientes`

### Respuesta 200
```json
[
  {
    "id_dependientes": 1,
    "Nombre": "Pedro",
    "Relacion": "Hijo",
    "Ocupacion": "Estudiante",
    "Fecha_nacimiento": "2015-03-10",
    "Peso_economico": 3
  }
]
```
> Nota: esta respuesta es un **array plano**, no está envuelta en `{ ok, ... }` como el resto de la API.

### Respuesta 500
```json
{ "error": "Error al obtener dependientes" }
```

---

## 2. 🔒 Agregar dependiente

`POST /api/dependientes`

### Body
```json
{
  "Nombre": "Pedro",
  "Relacion": "Hijo",
  "Ocupacion": "Estudiante",
  "Fecha_nacimiento": "2015-03-10",
  "Peso_economico": 3
}
```
> `Nombre` y `Relacion` son obligatorios. `Peso_economico` es un entero de 1 a 5 (definido en el schema). `Ocupacion` y `Peso_economico` son opcionales (`null` si se omiten).

### Respuesta 201
```json
{ "message": "Dependiente agregado", "id_dependientes": 4 }
```

### Respuesta 400
```json
{ "error": "Nombre y Relación son requeridos" }
```

---

## 3. 🔒 Editar dependiente

`PUT /api/dependientes/:id`

### Params
- `id` (URL) — id del dependiente (debe pertenecer al usuario autenticado).

### Body
```json
{
  "Nombre": "Pedro Andrés",
  "Relacion": "Hijo",
  "Ocupacion": "Estudiante universitario",
  "Fecha_nacimiento": "2015-03-10",
  "Peso_economico": 4
}
```

### Respuesta 200
```json
{ "message": "Dependiente actualizado" }
```

### Respuesta 400
```json
{ "error": "Nombre y Relación son requeridos" }
```

### Respuesta 404
```json
{ "error": "Dependiente no encontrado" }
```

---

## 4. 🔒 Eliminar dependiente

`DELETE /api/dependientes/:id`

Elimina el registro (borrado físico, no lógico).

### Respuesta 200
```json
{ "message": "Dependiente eliminado" }
```

### Respuesta 404
```json
{ "error": "Dependiente no encontrado" }
```

---

## Errores genéricos

```json
{ "error": "Error al <acción>" }
```
con status **500** ante cualquier excepción no controlada.

> Nota de formato: a diferencia de casi todos los demás controladores del backend (que usan `{ ok: boolean, mensaje }`), este controlador usa `{ error }` / `{ message }`. Tenlo en cuenta si vas a consumir la API desde un cliente genérico.

## Eliminar dependiente de otro usuario (admin)
🔒👑 `DELETE /api/dependientes/admin/:id` — rol `admin` o `superuser`. No filtra por propietario.
**200** `{ ok:true, message:"Dependiente eliminado por el administrador" }` · **400** id no entero · **403** sin rol · **404** `{ error:"Dependiente no encontrado" }` · **500** `{ error }`. Deja registro en `historial`.
