/**
 * RF-02 · Gestionar ingresos (backend)
 * Controlador: crearMovimiento, getIngresos, updateIngresos, deleteIngresos
 * Estrategia: app Express de prueba con solo movimientosRoutes; BD y servicios mockeados.
 * El JWT se firma de verdad para que verifyToken se ejecute sin mock.
 */

jest.mock("../../../Backend/src/db/connection", () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));
jest.mock("../../../Backend/src/controllers/PresupuestosController", () => ({
  actualizarIngresoReal: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../../Backend/src/service/OperacionesMovilesService", () => ({
  isOperationId: jest.fn(),
  reserve: jest.fn(),
  confirm: jest.fn(),
  withOperationIds: jest.fn(async (_pool, _usuario, rows) => rows),
}));
jest.mock("../../../Backend/src/service/NotificacionesService", () => ({
  verificarUmbralGastos: jest.fn(),
  verificarUmbralImprevistos: jest.fn(),
  verificarMetaAhorroAlcanzada: jest.fn(),
}));
jest.mock("../../../Backend/src/controllers/sincronizacionController", () => ({
  capacidades: jest.fn(),
  consultarOperacion: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

const pool = require("../../../Backend/src/db/connection");
const { actualizarIngresoReal } = require("../../../Backend/src/controllers/PresupuestosController");
const movimientosRoutes = require("../../../Backend/src/routes/movimientosRoutes");

// ── App de prueba ─────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use("/api/movimientos", movimientosRoutes);

const USER_ID = 7;
const token = (payload = { id: USER_ID }) => jwt.sign(payload, process.env.JWT_SECRET);
const auth = () => ({ Authorization: `Bearer ${token()}` });

// ── Cliente transaccional simulado ────────────────────────────
const client = { query: jest.fn(), release: jest.fn() };
const sqls = () => client.query.mock.calls.map(([s]) => String(s).replace(/\s+/g, " ").trim());
const llamada = (patron) => client.query.mock.calls.find(([s]) => patron.test(String(s)));

const pgError = (code) => Object.assign(new Error(`pg ${code}`), { code });

// Respuesta por defecto del flujo de creación
const flujoCrear = (sql) => {
  if (/INSERT INTO movimientos/.test(sql)) return { rows: [{ id_movimiento: 10 }] };
  if (/INSERT INTO entrada/.test(sql)) return { rows: [{ id_entrada: 20 }] };
  if (/INSERT INTO ingresos/.test(sql)) return { rows: [{ id_ingresos: 30 }] };
  return { rows: [] };
};

const bodyValido = (datos = {}) => ({
  tipo_flujo: "Entrada",
  subtipo_modulo: "Ingreso",
  datos: {
    monto: 1500000,
    descripcion: "Salario octubre",
    fuente: "Empresa SA",
    fecha_registro: "2026-11-01",
    id_categoria: 5,
    ...datos,
  },
});

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  pool.connect.mockResolvedValue(client);
  client.query.mockImplementation(async (sql) => flujoCrear(String(sql)));
  actualizarIngresoReal.mockResolvedValue(undefined);
});

// ═════════════════════════════════════════════════════════════
//  Precondición: sesión iniciada (JWT)
// ═════════════════════════════════════════════════════════════
describe("RF-02 · Autenticación requerida", () => {
  const rutas = [
    ["POST", "/api/movimientos", "post"],
    ["GET", "/api/movimientos/ingresos", "get"],
    ["PUT", "/api/movimientos/ingresos/1", "put"],
    ["DELETE", "/api/movimientos/ingresos/1", "delete"],
  ];

  it.each(rutas)("%s %s sin token → 401", async (_m, url, metodo) => {
    const res = await request(app)[metodo](url);
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it.each(rutas)("%s %s con token inválido → 401", async (_m, url, metodo) => {
    const res = await request(app)[metodo](url).set("Authorization", "Bearer token.falso.xyz");
    expect(res.status).toBe(401);
    expect(res.body.mensaje).toBe("Token inválido o expirado");
    expect(pool.connect).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════
//  Registrar ingreso
// ═════════════════════════════════════════════════════════════
describe("RF-02 · Registrar ingreso (POST /api/movimientos)", () => {
  it("crea el ingreso con datos completos → 201 y transacción confirmada", async () => {
    const res = await request(app).post("/api/movimientos").set(auth()).send(bodyValido());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      ok: true,
      mensaje: "Movimiento registrado exitosamente",
      ID_movimiento: 10,
      ID_detalle: 30,
    });

    const lista = sqls();
    expect(lista[0]).toBe("BEGIN");
    expect(lista[lista.length - 1]).toBe("COMMIT");

    // El movimiento se asocia al usuario del token
    expect(llamada(/INSERT INTO movimientos/)[1]).toEqual([USER_ID, "Entrada", "Ingreso"]);
    // Datos persistidos: [id_entrada, id_categoria, monto, descripcion, fuente, fecha]
    expect(llamada(/INSERT INTO ingresos/)[1]).toEqual([20, 5, 1500000, "Salario octubre", "Empresa SA", "2026-11-01"]);

    expect(actualizarIngresoReal).toHaveBeenCalledWith(USER_ID);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("sin fecha_registro envía null y la BD usa CURRENT_DATE", async () => {
    const body = bodyValido();
    delete body.datos.fecha_registro;

    const res = await request(app).post("/api/movimientos").set(auth()).send(body);

    expect(res.status).toBe(201);
    const [sql, params] = llamada(/INSERT INTO ingresos/);
    expect(params[5]).toBeNull();
    expect(sql).toMatch(/COALESCE\(\$6, CURRENT_DATE\)/);
  });

  it("descripción, fuente y categoría son opcionales (se guardan como null)", async () => {
    const res = await request(app)
      .post("/api/movimientos")
      .set(auth())
      .send({ tipo_flujo: "Entrada", subtipo_modulo: "Ingreso", datos: { monto: 100 } });

    expect(res.status).toBe(201);
    expect(llamada(/INSERT INTO ingresos/)[1]).toEqual([20, null, 100, null, null, null]);
  });

  it("acepta el monto como texto numérico y recorta espacios en los textos", async () => {
    const res = await request(app)
      .post("/api/movimientos")
      .set(auth())
      .send(bodyValido({ monto: "100.50", descripcion: "  Bono  ", fuente: " Jefe " }));

    expect(res.status).toBe(201);
    const params = llamada(/INSERT INTO ingresos/)[1];
    expect(params[2]).toBe(100.5);
    expect(params[3]).toBe("Bono");
    expect(params[4]).toBe("Jefe");
  });

  describe("validaciones → 400 sin abrir conexión a la BD", () => {
    const casos = [
      ["monto ausente", () => { const b = bodyValido(); delete b.datos.monto; return b; }, "El campo monto es requerido"],
      ["monto vacío", () => bodyValido({ monto: "" }), "El campo monto es requerido"],
      ["monto null", () => bodyValido({ monto: null }), "El campo monto es requerido"],
      ["monto 0", () => bodyValido({ monto: 0 }), "El monto debe ser mayor que cero"],
      ["monto negativo", () => bodyValido({ monto: -5 }), "El monto debe ser mayor que cero"],
      ["monto no numérico", () => bodyValido({ monto: "abc" }), "El monto debe ser un número válido"],
      ["monto booleano", () => bodyValido({ monto: true }), "El monto debe ser un número válido"],
      ["monto sobre el máximo", () => bodyValido({ monto: 1000000000001 }), "no puede superar"],
      ["descripción > 255", () => bodyValido({ descripcion: "a".repeat(256) }), "La descripción no puede superar 255 caracteres"],
      ["fuente > 150", () => bodyValido({ fuente: "a".repeat(151) }), "La fuente no puede superar 150 caracteres"],
      ["fecha inexistente", () => bodyValido({ fecha_registro: "2026-13-45" }), "La fecha de registro no es válida (use AAAA-MM-DD)"],
      ["fecha con formato incorrecto", () => bodyValido({ fecha_registro: "01/11/2026" }), "La fecha de registro no es válida (use AAAA-MM-DD)"],
      ["datos ausente", () => ({ tipo_flujo: "Entrada", subtipo_modulo: "Ingreso" }), "El campo datos es requerido"],
      ["tipo_flujo inválido", () => ({ ...bodyValido(), tipo_flujo: "Otro" }), "tipo_flujo inválido"],
      ["subtipo no válido para Entrada", () => ({ ...bodyValido(), subtipo_modulo: "Gasto" }), "Subtipo inválido para Entrada"],
    ];

    it.each(casos)("%s", async (_nombre, armar, mensaje) => {
      const res = await request(app).post("/api/movimientos").set(auth()).send(armar());

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.mensaje).toEqual(expect.stringContaining(mensaje));
      expect(pool.connect).not.toHaveBeenCalled();
    });
  });

  it("violación de FK (categoría inexistente, código 23503) → 400 con ROLLBACK", async () => {
    client.query.mockImplementation(async (sql) => {
      if (/INSERT INTO ingresos/.test(sql)) throw pgError("23503");
      return flujoCrear(String(sql));
    });

    const res = await request(app).post("/api/movimientos").set(auth()).send(bodyValido());

    expect(res.status).toBe(400);
    expect(res.body.mensaje).toBe("La categoría o el dependiente indicado no existe");
    expect(sqls()).toContain("ROLLBACK");
    expect(sqls()).not.toContain("COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("violación del CHECK de la BD (23514) → 400", async () => {
    client.query.mockImplementation(async (sql) => {
      if (/INSERT INTO ingresos/.test(sql)) throw pgError("23514");
      return flujoCrear(String(sql));
    });

    const res = await request(app).post("/api/movimientos").set(auth()).send(bodyValido());

    expect(res.status).toBe(400);
    expect(res.body.mensaje).toBe("Los datos enviados no cumplen las restricciones de la base de datos");
  });

  it("error inesperado de BD → 500 genérico con ROLLBACK", async () => {
    client.query.mockImplementation(async (sql) => {
      if (/INSERT INTO ingresos/.test(sql)) throw new Error("boom");
      return flujoCrear(String(sql));
    });

    const res = await request(app).post("/api/movimientos").set(auth()).send(bodyValido());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, mensaje: "Error interno del servidor" });
    expect(sqls()).toContain("ROLLBACK");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("si falla el recálculo del ingreso real tras el COMMIT, la creación sigue siendo 201", async () => {
    actualizarIngresoReal.mockRejectedValue(new Error("fallo presupuesto"));

    const res = await request(app).post("/api/movimientos").set(auth()).send(bodyValido());

    expect(res.status).toBe(201);
    expect(sqls()).toContain("COMMIT");
  });
});

// ═════════════════════════════════════════════════════════════
//  Consultar ingresos
// ═════════════════════════════════════════════════════════════
describe("RF-02 · Consultar ingresos (GET /api/movimientos/ingresos)", () => {
  it("devuelve el listado y filtra por el usuario del token", async () => {
    const filas = [
      { id: 2, monto: "200.00", descripcion: "Bono", fuente: "Jefe", fecha: "2026-11-02", id_categoria: 5, categoria: "Salario" },
      { id: 1, monto: "100.00", descripcion: null, fuente: null, fecha: "2026-11-01", id_categoria: null, categoria: null },
    ];
    pool.query.mockResolvedValue({ rows: filas });

    const res = await request(app).get("/api/movimientos/ingresos").set(auth());

    expect(res.status).toBe(200);
    expect(res.body).toEqual(filas);

    const [sql, params] = pool.query.mock.calls[0];
    expect(params).toEqual([USER_ID]);
    expect(sql).toContain("WHERE m.id_usuario = $1");
    expect(sql).toContain("ORDER BY i.fecha_registro DESC");
  });

  it("usuario sin ingresos → 200 con arreglo vacío", async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const res = await request(app).get("/api/movimientos/ingresos").set(auth());

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("error de BD → 500 genérico", async () => {
    pool.query.mockRejectedValue(new Error("boom"));

    const res = await request(app).get("/api/movimientos/ingresos").set(auth());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, mensaje: "Error interno del servidor" });
  });
});

// ═════════════════════════════════════════════════════════════
//  Editar ingreso
// ═════════════════════════════════════════════════════════════
describe("RF-02 · Editar ingreso (PUT /api/movimientos/ingresos/:id)", () => {
  const cuerpo = { monto: 200, descripcion: "Bono", fuente: "Jefe", fecha_registro: "2026-11-02", id_categoria: 3 };

  it("actualiza un ingreso propio → 200 y recalcula el ingreso real", async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });

    const res = await request(app).put("/api/movimientos/ingresos/5").set(auth()).send(cuerpo);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, mensaje: "Ingreso actualizado exitosamente" });

    const [sql, params] = pool.query.mock.calls[0];
    // [monto, descripcion, fuente, fecha, id_categoria, id (param de ruta), id_usuario]
    expect(params).toEqual([200, "Bono", "Jefe", "2026-11-02", 3, "5", USER_ID]);
    expect(sql).toContain("id_usuario = $7"); // solo edita ingresos del usuario autenticado
    expect(actualizarIngresoReal).toHaveBeenCalledWith(USER_ID);
  });

  it("campos opcionales omitidos se guardan como null; la fecha usa COALESCE (conserva la anterior)", async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });

    const res = await request(app).put("/api/movimientos/ingresos/5").set(auth()).send({ monto: 200 });

    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[0];
    expect(params).toEqual([200, null, null, null, null, "5", USER_ID]);
    expect(sql).toMatch(/COALESCE\(\$4, fecha_registro\)/);
  });

  it("ingreso inexistente o de otro usuario → 404 y no recalcula", async () => {
    pool.query.mockResolvedValue({ rowCount: 0 });

    const res = await request(app).put("/api/movimientos/ingresos/5").set(auth()).send(cuerpo);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, mensaje: "Ingreso no encontrado" });
    expect(actualizarIngresoReal).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-1", "1.5", "99999999999"])("id de ruta inválido (%s) → 400 sin consultar la BD", async (id) => {
    const res = await request(app).put(`/api/movimientos/ingresos/${id}`).set(auth()).send(cuerpo);

    expect(res.status).toBe(400);
    expect(res.body.mensaje).toBe("El parámetro 'id' debe ser un número entero positivo");
    expect(pool.query).not.toHaveBeenCalled();
  });

  it.each([
    ["monto ausente", { descripcion: "x" }, "El monto debe ser un número válido"],
    ["monto 0", { monto: 0 }, "El monto debe ser mayor que cero"],
    ["monto negativo", { monto: -1 }, "El monto debe ser mayor que cero"],
    ["fecha inválida", { monto: 10, fecha_registro: "2026-02-30" }, "La fecha de registro no es válida (use AAAA-MM-DD)"],
    ["descripción > 255", { monto: 10, descripcion: "a".repeat(256) }, "La descripción no puede superar 255 caracteres"],
    ["fuente > 150", { monto: 10, fuente: "a".repeat(151) }, "La fuente no puede superar 150 caracteres"],
  ])("%s → 400 sin consultar la BD", async (_n, body, mensaje) => {
    const res = await request(app).put("/api/movimientos/ingresos/5").set(auth()).send(body);

    expect(res.status).toBe(400);
    expect(res.body.mensaje).toBe(mensaje);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("violación del CHECK de la BD (23514) → 400", async () => {
    pool.query.mockRejectedValue(pgError("23514"));

    const res = await request(app).put("/api/movimientos/ingresos/5").set(auth()).send(cuerpo);

    expect(res.status).toBe(400);
    expect(res.body.mensaje).toBe("Los datos enviados no cumplen las restricciones de la base de datos");
  });

  it("error inesperado → 500 genérico", async () => {
    pool.query.mockRejectedValue(new Error("boom"));

    const res = await request(app).put("/api/movimientos/ingresos/5").set(auth()).send(cuerpo);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, mensaje: "Error interno del servidor" });
  });

  it("si falla el recálculo del ingreso real, la edición sigue siendo 200", async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });
    actualizarIngresoReal.mockRejectedValue(new Error("fallo presupuesto"));

    const res = await request(app).put("/api/movimientos/ingresos/5").set(auth()).send(cuerpo);

    expect(res.status).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════
//  Eliminar ingreso
// ═════════════════════════════════════════════════════════════
describe("RF-02 · Eliminar ingreso (DELETE /api/movimientos/ingresos/:id)", () => {
  it("elimina un ingreso propio → 200, borra en orden y confirma la transacción", async () => {
    client.query.mockImplementation(async (sql) => {
      if (/^\s*SELECT/.test(sql)) return { rows: [{ id_entrada: 20, id_movimiento: 10 }] };
      return { rows: [] };
    });

    const res = await request(app).delete("/api/movimientos/ingresos/5").set(auth());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, mensaje: "Ingreso eliminado exitosamente" });

    const lista = sqls();
    expect(lista[0]).toBe("BEGIN");
    expect(lista[1]).toMatch(/^SELECT/);
    expect(lista[2]).toMatch(/^DELETE FROM ingresos WHERE id_ingresos = \$1$/);
    expect(lista[3]).toMatch(/^DELETE FROM entrada WHERE id_entrada = \$1$/);
    expect(lista[4]).toMatch(/^DELETE FROM movimientos WHERE id_movimiento = \$1$/);
    expect(lista[5]).toBe("COMMIT");

    // La búsqueda restringe al usuario del token
    const [sqlSelect, paramsSelect] = client.query.mock.calls[1];
    expect(sqlSelect).toContain("m.id_usuario = $2");
    expect(paramsSelect).toEqual(["5", USER_ID]);
    // Borra los registros correctos
    expect(client.query.mock.calls[2][1]).toEqual(["5"]);
    expect(client.query.mock.calls[3][1]).toEqual([20]);
    expect(client.query.mock.calls[4][1]).toEqual([10]);

    expect(actualizarIngresoReal).toHaveBeenCalledWith(USER_ID);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("ingreso inexistente o de otro usuario → 404, ROLLBACK y sin DELETE", async () => {
    client.query.mockImplementation(async () => ({ rows: [] }));

    const res = await request(app).delete("/api/movimientos/ingresos/5").set(auth());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, mensaje: "Ingreso no encontrado" });
    expect(sqls()).toContain("ROLLBACK");
    expect(sqls().some((s) => /^DELETE/.test(s))).toBe(false);
    expect(actualizarIngresoReal).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it.each(["abc", "0", "-1", "1.5"])("id de ruta inválido (%s) → 400 sin abrir conexión", async (id) => {
    const res = await request(app).delete(`/api/movimientos/ingresos/${id}`).set(auth());

    expect(res.status).toBe(400);
    expect(res.body.mensaje).toBe("El parámetro 'id' debe ser un número entero positivo");
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("error durante el borrado → 500, ROLLBACK y conexión liberada", async () => {
    client.query.mockImplementation(async (sql) => {
      if (/^\s*SELECT/.test(sql)) return { rows: [{ id_entrada: 20, id_movimiento: 10 }] };
      if (/^\s*DELETE FROM entrada/.test(sql)) throw new Error("boom");
      return { rows: [] };
    });

    const res = await request(app).delete("/api/movimientos/ingresos/5").set(auth());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, mensaje: "Error interno del servidor" });
    expect(sqls()).toContain("ROLLBACK");
    expect(sqls()).not.toContain("COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("si falla el recálculo del ingreso real tras el COMMIT, el borrado sigue siendo 200", async () => {
    client.query.mockImplementation(async (sql) => {
      if (/^\s*SELECT/.test(sql)) return { rows: [{ id_entrada: 20, id_movimiento: 10 }] };
      return { rows: [] };
    });
    actualizarIngresoReal.mockRejectedValue(new Error("fallo presupuesto"));

    const res = await request(app).delete("/api/movimientos/ingresos/5").set(auth());

    expect(res.status).toBe(200);
  });
});