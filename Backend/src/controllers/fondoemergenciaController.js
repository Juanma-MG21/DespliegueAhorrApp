const pool = require("../db/connection");
const {
  LIMITES,
  aNumero,
  validarMonto,
  validarTexto,
} = require("../service/validaciones");
const { verificarUmbralEmergencia } = require("../service/NotificacionesService");

const ERROR_500 = { ok: false, mensaje: "Error interno del servidor" };
const SIN_FONDO = {
  ok: false,
  mensaje: "El usuario no tiene un fondo de emergencia configurado",
};

// ROLLBACK que nunca lanza (la conexión puede estar rota).
const rollbackSeguro = async (connection) => {
  if (!connection) return;
  try {
    await connection.query("ROLLBACK");
  } catch (_) {
    /* conexión ya cerrada */
  }
};

// Efectos posteriores al COMMIT: nunca deben tumbar una operación ya confirmada.
const efectoSeguro = async (fn) => {
  try {
    await fn();
  } catch (error) {
    console.error("Error en efecto posterior:", error.message);
  }
};

// Saldo = aportes − retiros (se calcula siempre a partir de los movimientos).
const SQL_SALDO = `
  COALESCE(
    SUM(
      CASE
        WHEN mfe.tipo = 'aporte' THEN mfe.monto
        WHEN mfe.tipo = 'retiro' THEN -mfe.monto
        ELSE 0
      END
    ),
    0
  )`;

// Obtener el fondo de emergencia del usuario
const getFondoEmergencia = async (req, res) => {
  const ID_usuario = req.usuario.id;

  try {
    const { rows: [fondo] } = await pool.query(
      `
      SELECT
        fe.id_fondo,
        fe.id_usuario,
        fe.meta,
        fe.fecha_creacion,
        fe.fecha_actualizacion,
        ${SQL_SALDO} AS saldo_actual
      FROM fondos_emergencia fe
      LEFT JOIN movimientos_fondo_emergencia mfe
        ON fe.id_fondo = mfe.id_fondo
      WHERE fe.id_usuario = $1
      GROUP BY
        fe.id_fondo,
        fe.id_usuario,
        fe.meta,
        fe.fecha_creacion,
        fe.fecha_actualizacion
      `,
      [ID_usuario]
    );

    if (!fondo) return res.status(404).json(SIN_FONDO);

    return res.status(200).json({ ok: true, datos: fondo });
  } catch (error) {
    console.error("Error obteniendo fondo de emergencia:", error.message);
    return res.status(500).json(ERROR_500);
  }
};

// Crear el fondo de emergencia (uno por usuario: UNIQUE(id_usuario))
const crearFondoEmergencia = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const body = req.body || {};

  // Sin meta → 0. Con meta debe ser un número válido >= 0 (antes un texto
  // inválido se convertía silenciosamente en 0).
  const hayMeta = body.meta !== undefined && body.meta !== null && body.meta !== "";
  if (hayMeta) {
    const errorMeta = validarMonto(body.meta, { nombre: "La meta", permitirCero: true });
    if (errorMeta) return res.status(400).json({ ok: false, mensaje: errorMeta });
  }
  const meta = hayMeta ? aNumero(body.meta) : 0;

  try {
    const { rows: [fondo] } = await pool.query(
      `
      INSERT INTO fondos_emergencia (id_usuario, meta)
      VALUES ($1, $2)
      RETURNING id_fondo, id_usuario, meta, fecha_creacion, fecha_actualizacion
      `,
      [ID_usuario, meta]
    );

    return res.status(201).json({
      ok: true,
      mensaje: "Fondo de emergencia creado correctamente",
      datos: fondo,
    });
  } catch (error) {
    // La restricción UNIQUE de id_usuario evita tener más de un fondo por usuario.
    if (error.code === "23505") {
      return res.status(409).json({
        ok: false,
        mensaje: "El usuario ya tiene un fondo de emergencia",
      });
    }

    console.error("Error creando fondo de emergencia:", error.message);
    return res.status(500).json(ERROR_500);
  }
};

// Actualizar la meta del fondo
const actualizarMetaFondoEmergencia = async (req, res) => {
  const ID_usuario = req.usuario.id;

  const errorMeta = validarMonto((req.body || {}).meta, {
    nombre: "La meta",
    permitirCero: true,
  });
  if (errorMeta) {
    return res.status(400).json({
      ok: false,
      mensaje: "La meta debe ser un número mayor o igual a 0 y dentro del rango permitido",
    });
  }
  const meta = aNumero(req.body.meta);

  try {
    const { rows: [fondo] } = await pool.query(
      `
      UPDATE fondos_emergencia
      SET meta = $1, fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id_usuario = $2
      RETURNING id_fondo, id_usuario, meta, fecha_creacion, fecha_actualizacion
      `,
      [meta, ID_usuario]
    );

    if (!fondo) return res.status(404).json(SIN_FONDO);

    return res.status(200).json({
      ok: true,
      mensaje: "Meta actualizada correctamente",
      datos: fondo,
    });
  } catch (error) {
    console.error("Error actualizando meta del fondo:", error.message);
    return res.status(500).json(ERROR_500);
  }
};

// Inserta un movimiento (aporte o retiro) dentro de una transacción ya abierta.
const insertarMovimiento = async (connection, idFondo, tipo, monto, descripcion) => {
  const { rows: [movimiento] } = await connection.query(
    `
    INSERT INTO movimientos_fondo_emergencia (id_fondo, tipo, monto, descripcion)
    VALUES ($1, $2, $3, $4)
    RETURNING id_movimiento_fondo, id_fondo, tipo, monto, fecha_registro, descripcion
    `,
    [idFondo, tipo, monto, descripcion]
  );

  await connection.query(
    `UPDATE fondos_emergencia SET fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_fondo = $1`,
    [idFondo]
  );

  return movimiento;
};

// Registrar un aporte al fondo
const registrarAporte = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const body = req.body || {};

  const errorMonto = validarMonto(body.monto, { nombre: "El monto del aporte" });
  if (errorMonto) return res.status(400).json({ ok: false, mensaje: errorMonto });

  const errorDesc = validarTexto(body.descripcion, LIMITES.descripcion, "La descripción");
  if (errorDesc) return res.status(400).json({ ok: false, mensaje: errorDesc });

  const monto = aNumero(body.monto);
  const descripcion =
    typeof body.descripcion === "string" && body.descripcion.trim()
      ? body.descripcion.trim()
      : null;

  let connection;

  try {
    connection = await pool.connect();
    await connection.query("BEGIN");

    const { rows: [fondo] } = await connection.query(
      `SELECT id_fondo FROM fondos_emergencia WHERE id_usuario = $1 FOR UPDATE`,
      [ID_usuario]
    );

    if (!fondo) {
      await connection.query("ROLLBACK");
      return res.status(404).json(SIN_FONDO);
    }

    const movimiento = await insertarMovimiento(connection, fondo.id_fondo, "aporte", monto, descripcion);

    await connection.query("COMMIT");

    await efectoSeguro(() => verificarUmbralEmergencia(ID_usuario));

    return res.status(201).json({
      ok: true,
      mensaje: "Aporte registrado correctamente",
      datos: movimiento,
    });
  } catch (error) {
    await rollbackSeguro(connection);
    console.error("Error registrando aporte:", error.message);
    return res.status(500).json(ERROR_500);
  } finally {
    if (connection) connection.release();
  }
};

// Registrar un retiro del fondo
const registrarRetiro = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const body = req.body || {};

  const errorMonto = validarMonto(body.monto, { nombre: "El monto del retiro" });
  if (errorMonto) return res.status(400).json({ ok: false, mensaje: errorMonto });

  const errorDesc = validarTexto(body.descripcion, LIMITES.descripcion, "La descripción");
  if (errorDesc) return res.status(400).json({ ok: false, mensaje: errorDesc });

  const monto = aNumero(body.monto);
  const descripcion =
    typeof body.descripcion === "string" && body.descripcion.trim()
      ? body.descripcion.trim()
      : null;

  let connection;

  try {
    connection = await pool.connect();
    await connection.query("BEGIN");

    // 1) Se bloquea la fila del fondo. NOTA: la versión anterior combinaba
    //    GROUP BY + LEFT JOIN + FOR UPDATE en una sola consulta, algo que
    //    PostgreSQL rechaza ("FOR UPDATE is not allowed with GROUP BY"), por
    //    lo que todo retiro terminaba en error 500.
    const { rows: [fondo] } = await connection.query(
      `SELECT id_fondo FROM fondos_emergencia WHERE id_usuario = $1 FOR UPDATE`,
      [ID_usuario]
    );

    if (!fondo) {
      await connection.query("ROLLBACK");
      return res.status(404).json(SIN_FONDO);
    }

    // 2) Con el fondo bloqueado se calcula el saldo (dos retiros simultáneos
    //    no pueden pasar ambos la validación).
    const { rows: [{ saldo_actual }] } = await connection.query(
      `
      SELECT ${SQL_SALDO} AS saldo_actual
      FROM movimientos_fondo_emergencia mfe
      WHERE mfe.id_fondo = $1
      `,
      [fondo.id_fondo]
    );

    // Comparación en centavos para evitar errores de coma flotante.
    if (Math.round(monto * 100) > Math.round(Number(saldo_actual) * 100)) {
      await connection.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        mensaje: "El retiro no puede ser mayor al saldo disponible",
      });
    }

    const movimiento = await insertarMovimiento(connection, fondo.id_fondo, "retiro", monto, descripcion);

    await connection.query("COMMIT");

    await efectoSeguro(() => verificarUmbralEmergencia(ID_usuario));

    return res.status(201).json({
      ok: true,
      mensaje: "Retiro registrado correctamente",
      datos: movimiento,
    });
  } catch (error) {
    await rollbackSeguro(connection);
    console.error("Error registrando retiro:", error.message);
    return res.status(500).json(ERROR_500);
  } finally {
    if (connection) connection.release();
  }
};

// Obtener historial de movimientos del fondo
const getMovimientosFondoEmergencia = async (req, res) => {
  const ID_usuario = req.usuario.id;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        mfe.id_movimiento_fondo,
        mfe.id_fondo,
        mfe.tipo,
        mfe.monto,
        mfe.fecha_registro,
        mfe.descripcion
      FROM movimientos_fondo_emergencia mfe
      INNER JOIN fondos_emergencia fe
        ON mfe.id_fondo = fe.id_fondo
      WHERE fe.id_usuario = $1
      ORDER BY mfe.fecha_registro DESC, mfe.id_movimiento_fondo DESC
      `,
      [ID_usuario]
    );

    return res.status(200).json({ ok: true, datos: rows });
  } catch (error) {
    console.error("Error obteniendo movimientos del fondo:", error.message);
    return res.status(500).json(ERROR_500);
  }
};

module.exports = {
  getFondoEmergencia,
  crearFondoEmergencia,
  actualizarMetaFondoEmergencia,
  registrarAporte,
  registrarRetiro,
  getMovimientosFondoEmergencia,
};