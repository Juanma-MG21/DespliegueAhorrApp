const { actualizarIngresoReal } = require("../controllers/PresupuestosController");

const pool = require("../db/connection");
const {
  isOperationId,
  reserve,
  confirm,
  withOperationIds,
} = require("../service/OperacionesMovilesService");
const {
  verificarUmbralGastos,
  verificarUmbralImprevistos,
  verificarUmbralDeudas,
  verificarUmbralAhorros,
  verificarMetaAhorroAlcanzada,
  verificarDeudasProximasAVencer,
} = require("../service/NotificacionesService");
const {
  LIMITES,
  aNumero,
  validarMonto,
  validarTexto,
  normalizarFecha,
  fechaInvalida,
  esEnteroPositivo,
  primerError,
  responderErrorBD,
} = require("../service/validaciones");

// ─────────────────────────────────────────────────────────────
//  HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────

const ERROR_500 = { ok: false, mensaje: "Error interno del servidor" };

// Agrega operation_id (UUID de la app móvil) a las filas ya creadas desde offline.
// Si falla, el listado se entrega igual: la app también concilia por id.
const conOperaciones = async (usuario, rows) => {
  try {
    return await withOperationIds(pool, usuario, rows);
  } catch (error) {
    console.error("No se pudo asociar operation_id:", error.message);
    return rows.map(({ _rf19_movimiento, ...fila }) => ({ ...fila, operation_id: null }));
  }
};

// Texto opcional → string recortado o null.
const limpiar = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

// Redondeo a centavos (la DB guarda DECIMAL(15,2)).
const redondear2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const aCentavos = (n) => Math.round(Number(n) * 100);

// ROLLBACK que nunca lanza (la conexión puede estar rota).
const rollbackSeguro = async (connection) => {
  if (!connection) return;
  try {
    await connection.query("ROLLBACK");
  } catch (_) {
    /* conexión ya cerrada: nada que revertir */
  }
};

// Efectos posteriores al COMMIT (recalcular ingreso real, alertas...).
// Un fallo aquí NUNCA debe convertir en error una operación ya confirmada.
const efectoSeguro = async (fn) => {
  try {
    await fn();
  } catch (error) {
    console.error("Error en efecto posterior al movimiento:", error.message);
  }
};

// Valida los datos de un movimiento según su subtipo (creación y edición).
// Devuelve un mensaje de error o null.
const validarDatos = (subtipo, d, { esUpdate = false } = {}) => {
  const errMonto = validarMonto(d.monto);
  if (errMonto) return errMonto;

  if (d.fecha_registro !== undefined && fechaInvalida(d.fecha_registro)) {
    return "La fecha de registro no es válida (use AAAA-MM-DD)";
  }

  switch (subtipo) {
    case "Ingreso":
      return primerError(
        validarTexto(d.descripcion, LIMITES.descripcion, "La descripción"),
        validarTexto(d.fuente, LIMITES.fuente, "La fuente")
      );

    case "Gasto":
      return validarTexto(d.descripcion, LIMITES.descripcion, "La descripción");

    case "Imprevisto":
      return validarTexto(d.causa, LIMITES.causa, "La causa");

    case "Ahorro": {
      if (!esUpdate && !limpiar(d.meta)) {
        return "El nombre de la meta es requerido";
      }
      if (d.fecha_meta !== undefined && fechaInvalida(d.fecha_meta)) {
        return "La fecha meta no es válida (use AAAA-MM-DD)";
      }
      const registro = normalizarFecha(d.fecha_registro);
      const meta = normalizarFecha(d.fecha_meta);
      if (registro && meta && meta < registro) {
        return "La fecha meta no puede ser anterior a la fecha de registro";
      }
      return primerError(
        validarTexto(d.descripcion, LIMITES.descripcion, "La descripción"),
        validarTexto(d.meta, LIMITES.meta, "El nombre de la meta")
      );
    }

    case "Deuda": {
      if (!limpiar(d.fuente)) return "La fuente de la deuda es requerida";
      if (
        d.cuotas_total !== undefined &&
        d.cuotas_total !== null &&
        d.cuotas_total !== "" &&
        !esEnteroPositivo(d.cuotas_total)
      ) {
        return "El número de cuotas debe ser un entero mayor que cero";
      }
      if (d.fecha_inicio !== undefined && fechaInvalida(d.fecha_inicio)) {
        return "La fecha de inicio no es válida (use AAAA-MM-DD)";
      }
      if (d.fecha_fin !== undefined && fechaInvalida(d.fecha_fin)) {
        return "La fecha de fin no es válida (use AAAA-MM-DD)";
      }
      const inicio = normalizarFecha(d.fecha_inicio);
      const fin = normalizarFecha(d.fecha_fin);
      if (inicio && fin && fin < inicio) {
        return "La fecha de fin no puede ser anterior a la fecha de inicio";
      }
      return primerError(
        validarTexto(d.fuente, LIMITES.fuente, "La fuente"),
        validarTexto(d.descripcion, LIMITES.descripcion, "La descripción")
      );
    }

    default:
      return null;
  }
};

// Valida que la deuda editada sea coherente. Devuelve error o null.
const validarCuotasDeuda = (cuotasPagadas, cuotasTotal) => {
  if (cuotasPagadas !== null) {
    const n = aNumero(cuotasPagadas);
    if (!Number.isInteger(n) || n < 0) {
      return "Las cuotas pagadas deben ser un entero mayor o igual a cero";
    }
    // Pago único (sin cuotas_total) equivale a 1 cuota.
    const limite = cuotasTotal !== null ? cuotasTotal : 1;
    if (n > limite) {
      return "Las cuotas pagadas no pueden superar el total de cuotas";
    }
  }
  return null;
};

// Eliminador genérico: borra el detalle, su fila padre (entrada/salida) y el
// movimiento, validando que pertenezcan al usuario. Mismo comportamiento que
// los cinco delete* originales.
const crearEliminador = ({
  tabla,
  columnaId,
  padre,
  nombre,
  mensajeOk,
  alEliminar,
}) => async (req, res) => {
  const ID_usuario = req.usuario.id;
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.connect();
    await connection.query("BEGIN");

    const { rows: [fila] } = await connection.query(
      `SELECT p.id_${padre}, p.id_movimiento
         FROM ${tabla} t
         INNER JOIN ${padre} p     ON t.id_${padre}   = p.id_${padre}
         INNER JOIN movimientos m  ON p.id_movimiento = m.id_movimiento
        WHERE t.${columnaId} = $1 AND m.id_usuario = $2`,
      [id, ID_usuario]
    );

    if (!fila) {
      await connection.query("ROLLBACK");
      return res.status(404).json({ ok: false, mensaje: `${nombre} no encontrado` });
    }

    await connection.query(`DELETE FROM ${tabla}     WHERE ${columnaId} = $1`, [id]);
    await connection.query(`DELETE FROM ${padre}     WHERE id_${padre} = $1`, [fila[`id_${padre}`]]);
    await connection.query(`DELETE FROM movimientos  WHERE id_movimiento = $1`, [fila.id_movimiento]);

    await connection.query("COMMIT");

    if (alEliminar) await efectoSeguro(() => alEliminar(ID_usuario));

    return res.status(200).json({ ok: true, mensaje: mensajeOk });
  } catch (error) {
    await rollbackSeguro(connection);
    console.error(`Error eliminando ${nombre}:`, error.message);
    return res.status(500).json(ERROR_500);
  } finally {
    if (connection) connection.release();
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /movimientos  (consolidado para el asistente)
// ─────────────────────────────────────────────────────────────
const getMovimientos = async (req, res) => {
  const ID_usuario = req.usuario.id;

  try {
    const { rows: ingresos } = await pool.query(
      "SELECT 'ingreso' as tipo, monto as monto, descripcion as descripcion, fecha_registro as fecha FROM ingresos i JOIN entrada s ON i.id_entrada = s.id_entrada JOIN movimientos m ON s.id_movimiento = m.id_movimiento WHERE m.id_usuario = $1",
      [ID_usuario]
    );

    const { rows: gastos } = await pool.query(
      "SELECT 'gasto' as tipo, monto as monto, descripcion as descripcion, fecha_registro as fecha FROM gastos g JOIN salida s ON g.id_salida = s.id_salida JOIN movimientos m ON s.id_movimiento = m.id_movimiento WHERE m.id_usuario = $1",
      [ID_usuario]
    );

    const { rows: deudas } = await pool.query(
      "SELECT 'deuda' as tipo, monto as monto, descripcion as descripcion, estado as estado, fecha_fin as fecha FROM deudas d JOIN salida s ON d.id_salida = s.id_salida JOIN movimientos m ON s.id_movimiento = m.id_movimiento WHERE m.id_usuario = $1",
      [ID_usuario]
    );

    const { rows: ahorros } = await pool.query(
      "SELECT 'ahorro' as tipo, monto_acumulado as monto, descripcion as descripcion, fecha_registro as fecha, fecha_meta as fecha_meta FROM ahorros a JOIN entrada s ON a.id_entrada = s.id_entrada JOIN movimientos m ON s.id_movimiento = m.id_movimiento WHERE m.id_usuario = $1",
      [ID_usuario]
    );

    const { rows: imprevistos } = await pool.query(
      "SELECT 'imprevisto' as tipo, monto as monto, causa as descripcion, fecha_registro as fecha FROM imprevistos i JOIN salida s ON i.id_salida = s.id_salida JOIN movimientos m ON s.id_movimiento = m.id_movimiento WHERE m.id_usuario = $1",
      [ID_usuario]
    );

    res.status(200).json([...ingresos, ...gastos, ...deudas, ...ahorros, ...imprevistos]);
  } catch (error) {
    console.error("Error en getMovimientos:", error.message);
    res.status(500).json({ ok: false, mensaje: "Error al recopilar movimientos" });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /movimientos
// ─────────────────────────────────────────────────────────────
const crearMovimiento = async (req, res) => {
  const { tipo_flujo, subtipo_modulo, datos, operation_id } = req.body || {};

  // 1. Validaciones tempranas, ANTES de abrir la conexión a la BD
  if (!datos || typeof datos !== "object") {
    return res.status(400).json({ ok: false, mensaje: "El campo datos es requerido" });
  }

  if (datos.monto === undefined || datos.monto === null || datos.monto === "") {
    return res.status(400).json({ ok: false, mensaje: "El campo monto es requerido" });
  }

  if (!["Entrada", "Salida"].includes(tipo_flujo)) {
    return res.status(400).json({ ok: false, mensaje: "tipo_flujo inválido" });
  }

  const entradas = ["Ahorro", "Ingreso"];
  const salidas = ["Gasto", "Deuda", "Imprevisto"];

  if (tipo_flujo === "Entrada" && !entradas.includes(subtipo_modulo)) {
    return res.status(400).json({ ok: false, mensaje: "Subtipo inválido para Entrada" });
  }

  if (tipo_flujo === "Salida" && !salidas.includes(subtipo_modulo)) {
    return res.status(400).json({ ok: false, mensaje: "Subtipo inválido para Salida" });
  }

  const errorDatos = validarDatos(subtipo_modulo, datos);
  if (errorDatos) {
    return res.status(400).json({ ok: false, mensaje: errorDatos });
  }

  // Idempotencia para la app móvil (RF19): con operation_id, un reintento
  // devuelve la respuesta original en lugar de crear el movimiento otra vez.
  // Sin operation_id (cliente web) el comportamiento no cambia.
  const conOperacion = operation_id !== undefined && operation_id !== null;
  if (conOperacion && !isOperationId(operation_id)) {
    return res.status(400).json({ ok: false, mensaje: "operation_id inválido" });
  }
  const huella = { tipo_flujo, subtipo_modulo, datos };

  const monto = aNumero(datos.monto);
  const fechaRegistro = normalizarFecha(datos.fecha_registro); // null → CURRENT_DATE

  // 2. Transacción
  let connection;

  try {
    connection = await pool.connect();
    const ID_usuario = req.usuario.id;
    await connection.query("BEGIN");

    if (conOperacion) {
      // Debe ser lo primero de la transacción (fija el aislamiento y bloquea el UUID).
      const previa = await reserve(connection, ID_usuario, operation_id, huella);
      if (previa.conflict) {
        await rollbackSeguro(connection);
        return res.status(409).json({
          ok: false,
          mensaje: "El identificador de operación ya se usó con otros datos.",
        });
      }
      if (previa.response) {
        await rollbackSeguro(connection);
        return res.status(200).json({ ...previa.response, operation_id, repetido: true });
      }
    }

    const { rows: [movimiento] } = await connection.query(
      `INSERT INTO movimientos (id_usuario, tipo_flujo, subtipo_modulo)
       VALUES ($1, $2, $3)
       RETURNING id_movimiento`,
      [ID_usuario, tipo_flujo, subtipo_modulo]
    );
    const ID_movimiento = movimiento.id_movimiento;

    let ID_detalle = null;

    if (tipo_flujo === "Entrada") {
      const { rows: [entrada] } = await connection.query(
        `INSERT INTO entrada (id_movimiento) VALUES ($1) RETURNING id_entrada`,
        [ID_movimiento]
      );
      const ID_entrada = entrada.id_entrada;

      if (subtipo_modulo === "Ingreso") {
        const { rows: [result] } = await connection.query(
          `INSERT INTO ingresos (id_entrada, id_categoria, monto, descripcion, fuente, fecha_registro)
           VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE))
           RETURNING id_ingresos`,
          [
            ID_entrada,
            datos.id_categoria || null,
            monto,
            limpiar(datos.descripcion),
            limpiar(datos.fuente),
            fechaRegistro,
          ]
        );
        ID_detalle = result.id_ingresos;
      } else if (subtipo_modulo === "Ahorro") {
        const { rows: [result] } = await connection.query(
          `INSERT INTO ahorros (id_entrada, id_categoria, monto, descripcion, meta, fecha_registro, fecha_meta)
           VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE), $7)
           RETURNING id_ahorros`,
          [
            ID_entrada,
            datos.id_categoria || null,
            monto,
            limpiar(datos.descripcion),
            limpiar(datos.meta),
            fechaRegistro,
            normalizarFecha(datos.fecha_meta),
          ]
        );
        ID_detalle = result.id_ahorros;
      }
    } else {
      const { rows: [salida] } = await connection.query(
        `INSERT INTO salida (id_movimiento) VALUES ($1) RETURNING id_salida`,
        [ID_movimiento]
      );
      const ID_salida = salida.id_salida;

      if (subtipo_modulo === "Gasto") {
        const { rows: [result] } = await connection.query(
          `INSERT INTO gastos (id_salida, id_categoria, monto, descripcion, fecha_registro, id_dependientes)
           VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6)
           RETURNING id_gastos`,
          [
            ID_salida,
            datos.id_categoria || null,
            monto,
            limpiar(datos.descripcion),
            fechaRegistro,
            datos.id_dependientes || null,
          ]
        );
        ID_detalle = result.id_gastos;
      } else if (subtipo_modulo === "Imprevisto") {
        const { rows: [result] } = await connection.query(
          `INSERT INTO imprevistos (id_salida, id_categoria, monto, causa, fecha_registro, id_dependientes)
           VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6)
           RETURNING id_imprevistos`,
          [
            ID_salida,
            datos.id_categoria || null,
            monto,
            limpiar(datos.causa),
            fechaRegistro,
            datos.id_dependientes || null,
          ]
        );
        ID_detalle = result.id_imprevistos;
      } else if (subtipo_modulo === "Deuda") {
        const { rows: [result] } = await connection.query(
          `INSERT INTO deudas (id_salida, id_categoria, monto, fuente, descripcion, cuotas_total, fecha_inicio, fecha_fin)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id_deudas`,
          [
            ID_salida,
            datos.id_categoria || null,
            monto,
            limpiar(datos.fuente),
            limpiar(datos.descripcion),
            datos.cuotas_total ? Number(datos.cuotas_total) : null,
            normalizarFecha(datos.fecha_inicio),
            normalizarFecha(datos.fecha_fin),
          ]
        );
        ID_detalle = result.id_deudas;
      }
    }

    const respuesta = {
      ok: true,
      mensaje: "Movimiento registrado exitosamente",
      ID_movimiento,
      ID_detalle,
    };
    // Se confirma en la MISMA transacción que el movimiento.
    if (conOperacion) {
      await confirm(connection, ID_usuario, operation_id, respuesta, huella);
    }

    await connection.query("COMMIT");

    // Efectos posteriores: no deben tumbar una creación ya confirmada.
    if (subtipo_modulo === "Ingreso") {
      await efectoSeguro(() => actualizarIngresoReal(ID_usuario));
    } else if (subtipo_modulo === "Gasto") {
      await efectoSeguro(() => verificarUmbralGastos(ID_usuario));
    } else if (subtipo_modulo === "Imprevisto") {
      await efectoSeguro(() => verificarUmbralImprevistos(ID_usuario));
    } else if (subtipo_modulo === "Deuda") {
      await efectoSeguro(() => verificarUmbralDeudas(ID_usuario));
      await efectoSeguro(() => verificarDeudasProximasAVencer(ID_usuario));
    } else if (subtipo_modulo === "Ahorro") {
      await efectoSeguro(() => verificarUmbralAhorros(ID_usuario));
    }

    return res.status(201).json(conOperacion ? { ...respuesta, operation_id } : respuesta);
  } catch (error) {
    await rollbackSeguro(connection);
    if (responderErrorBD(res, error, "crearMovimiento")) return;
    return res.status(500).json(ERROR_500);
  } finally {
    if (connection) connection.release();
  }
};

// <==&&==·········· INGRESOS ··········==&&==>

const getIngresos = async (req, res) => {
  const ID_usuario = req.usuario.id;
  try {
    const { rows } = await pool.query(
      `SELECT i.id_ingresos AS id, i.monto AS monto, i.descripcion AS descripcion,
              i.fuente AS fuente, i.fecha_registro AS fecha, i.id_categoria,
              c.nombre AS categoria, m.id_movimiento AS _rf19_movimiento
       FROM ingresos i
       INNER JOIN entrada e     ON i.id_entrada    = e.id_entrada
       INNER JOIN movimientos m ON e.id_movimiento = m.id_movimiento
       LEFT  JOIN categorias c  ON i.id_categoria  = c.id_categoria
       WHERE m.id_usuario = $1
       ORDER BY i.fecha_registro DESC`,
      [ID_usuario]
    );
    res.status(200).json(await conOperaciones(ID_usuario, rows));
  } catch (error) {
    console.error("Error en getIngresos:", error.message);
    res.status(500).json(ERROR_500);
  }
};

const updateIngresos = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const { id } = req.params;
  const { monto, descripcion, fuente, fecha_registro, id_categoria } = req.body || {};

  const errorDatos = validarDatos("Ingreso", { monto, descripcion, fuente, fecha_registro }, { esUpdate: true });
  if (errorDatos) return res.status(400).json({ ok: false, mensaje: errorDatos });

  try {
    const result = await pool.query(
      `UPDATE ingresos
          SET monto = $1, descripcion = $2, fuente = $3,
              fecha_registro = COALESCE($4, fecha_registro), id_categoria = $5
        WHERE id_ingresos = $6
          AND id_entrada IN (SELECT id_entrada FROM entrada WHERE id_movimiento IN
              (SELECT id_movimiento FROM movimientos WHERE id_usuario = $7))`,
      [
        aNumero(monto),
        limpiar(descripcion),
        limpiar(fuente),
        normalizarFecha(fecha_registro),
        id_categoria || null,
        id,
        ID_usuario,
      ]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, mensaje: "Ingreso no encontrado" });
    }

    // El ingreso real del período activo debe reflejar la edición.
    await efectoSeguro(() => actualizarIngresoReal(ID_usuario));

    res.status(200).json({ ok: true, mensaje: "Ingreso actualizado exitosamente" });
  } catch (error) {
    if (responderErrorBD(res, error, "updateIngresos")) return;
    res.status(500).json(ERROR_500);
  }
};

const deleteIngresos = crearEliminador({
  tabla: "ingresos",
  columnaId: "id_ingresos",
  padre: "entrada",
  nombre: "Ingreso",
  mensajeOk: "Ingreso eliminado exitosamente",
  alEliminar: (ID_usuario) => actualizarIngresoReal(ID_usuario),
});

// <==&&==·········· AHORROS ··········==&&==>

async function getAhorros(req, res) {
  const ID_usuario = req.usuario.id;
  try {
    const { rows } = await pool.query(
      `SELECT a.id_ahorros AS id, a.monto AS monto, a.monto_acumulado AS monto_acumulado,
              a.descripcion AS descripcion, a.meta AS meta,
              a.fecha_registro AS fecha, a.fecha_meta AS fecha_meta,
              a.id_categoria,
              c.nombre AS categoria, m.id_movimiento AS _rf19_movimiento
       FROM ahorros a
       INNER JOIN entrada e     ON a.id_entrada    = e.id_entrada
       INNER JOIN movimientos m ON e.id_movimiento = m.id_movimiento
       LEFT  JOIN categorias c  ON a.id_categoria  = c.id_categoria
       WHERE m.id_usuario = $1
       ORDER BY a.fecha_registro DESC`,
      [ID_usuario]
    );
    res.status(200).json(await conOperaciones(ID_usuario, rows));
  } catch (error) {
    console.error("Error en getAhorros:", error.message);
    res.status(500).json(ERROR_500);
  }
}

const updateAhorros = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const { id } = req.params;
  const { monto, monto_acumulado, descripcion, meta, fecha_registro, fecha_meta, id_categoria } = req.body || {};

  const errorDatos = validarDatos(
    "Ahorro",
    { monto, descripcion, meta, fecha_registro, fecha_meta },
    { esUpdate: true }
  );
  if (errorDatos) return res.status(400).json({ ok: false, mensaje: errorDatos });

  // monto_acumulado es opcional: si no llega se conserva el valor de la DB
  // (evita que un cliente con datos viejos pise abonos recientes).
  let acumuladoSolicitado = null;
  if (monto_acumulado !== undefined && monto_acumulado !== null && monto_acumulado !== "") {
    const errAcum = validarMonto(monto_acumulado, { nombre: "El monto acumulado", permitirCero: true });
    if (errAcum) return res.status(400).json({ ok: false, mensaje: errAcum });
    acumuladoSolicitado = aNumero(monto_acumulado);
  }

  try {
    const { rows: [actual] } = await pool.query(
      `SELECT a.id_ahorros, a.monto_acumulado, a.meta
         FROM ahorros a
         INNER JOIN entrada e     ON a.id_entrada    = e.id_entrada
         INNER JOIN movimientos m ON e.id_movimiento = m.id_movimiento
        WHERE a.id_ahorros = $1 AND m.id_usuario = $2`,
      [id, ID_usuario]
    );
    if (!actual) {
      return res.status(404).json({ ok: false, mensaje: "Ahorro no encontrado" });
    }

    const nuevoMonto = aNumero(monto);
    const nuevoAcumulado = acumuladoSolicitado !== null
      ? acumuladoSolicitado
      : Number(actual.monto_acumulado);

    if (aCentavos(nuevoAcumulado) > aCentavos(nuevoMonto)) {
      return res.status(400).json({
        ok: false,
        mensaje: "La meta no puede ser menor a lo ya acumulado",
      });
    }

    await pool.query(
      `UPDATE ahorros
          SET monto = $1, monto_acumulado = $2, descripcion = $3, meta = $4,
              fecha_registro = COALESCE($5, fecha_registro), fecha_meta = $6, id_categoria = $7
        WHERE id_ahorros = $8`,
      [
        nuevoMonto,
        nuevoAcumulado,
        limpiar(descripcion),
        limpiar(meta),
        normalizarFecha(fecha_registro),
        normalizarFecha(fecha_meta),
        id_categoria || null,
        id,
      ]
    );

    // Si el ajuste completa la meta, se notifica igual que con un abono.
    if (aCentavos(nuevoAcumulado) >= aCentavos(nuevoMonto)) {
      await efectoSeguro(() =>
        verificarMetaAhorroAlcanzada(
          ID_usuario,
          { id_ahorros: actual.id_ahorros, meta_monto: nuevoMonto, meta_nombre: limpiar(meta) },
          nuevoAcumulado
        )
      );
    }

    await efectoSeguro(() => verificarUmbralAhorros(ID_usuario));

    res.status(200).json({ ok: true, mensaje: "Ahorro actualizado exitosamente" });
  } catch (error) {
    if (responderErrorBD(res, error, "updateAhorros")) return;
    res.status(500).json(ERROR_500);
  }
};

const deleteAhorros = crearEliminador({
  tabla: "ahorros",
  columnaId: "id_ahorros",
  padre: "entrada",
  nombre: "Ahorro",
  mensajeOk: "Ahorro eliminado exitosamente",
  alEliminar: (ID_usuario) => verificarUmbralAhorros(ID_usuario),
});

// <==&&==·········· GASTOS ··········==&&==>

const getGastos = async (req, res) => {
  const ID_usuario = req.usuario.id;
  try {
    const { rows } = await pool.query(
      `SELECT g.id_gastos AS id,
        g.monto AS monto,
        g.descripcion AS descripcion,
        g.fecha_registro AS fecha,
        g.id_categoria,
        g.id_dependientes,
        c.nombre AS categoria,
        d.nombre AS dependiente,
        m.id_movimiento AS _rf19_movimiento
       FROM gastos g
       INNER JOIN salida s       ON g.id_salida      = s.id_salida
       INNER JOIN movimientos m  ON s.id_movimiento  = m.id_movimiento
       LEFT  JOIN categorias c   ON g.id_categoria   = c.id_categoria
       LEFT  JOIN dependientes d ON g.id_dependientes = d.id_dependientes
       WHERE m.id_usuario = $1
       ORDER BY g.fecha_registro DESC`,
      [ID_usuario]
    );
    res.status(200).json(await conOperaciones(ID_usuario, rows));
  } catch (error) {
    console.error("Error en getGastos:", error.message);
    res.status(500).json(ERROR_500);
  }
};

const updateGastos = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const { id } = req.params;
  const { monto, descripcion, fecha_registro, id_categoria, id_dependientes } = req.body || {};

  const errorDatos = validarDatos("Gasto", { monto, descripcion, fecha_registro }, { esUpdate: true });
  if (errorDatos) return res.status(400).json({ ok: false, mensaje: errorDatos });

  try {
    const result = await pool.query(
      `UPDATE gastos
          SET monto = $1, descripcion = $2, fecha_registro = COALESCE($3, fecha_registro),
              id_categoria = $4, id_dependientes = $5
        WHERE id_gastos = $6
          AND id_salida IN (SELECT id_salida FROM salida WHERE id_movimiento IN
              (SELECT id_movimiento FROM movimientos WHERE id_usuario = $7))`,
      [
        aNumero(monto),
        limpiar(descripcion),
        normalizarFecha(fecha_registro),
        id_categoria || null,
        id_dependientes || null,
        id,
        ID_usuario,
      ]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, mensaje: "Gasto no encontrado" });
    }

    await efectoSeguro(() => verificarUmbralGastos(ID_usuario));

    res.status(200).json({ ok: true, mensaje: "Gasto actualizado exitosamente" });
  } catch (error) {
    if (responderErrorBD(res, error, "updateGastos")) return;
    res.status(500).json(ERROR_500);
  }
};

const deleteGastos = crearEliminador({
  tabla: "gastos",
  columnaId: "id_gastos",
  padre: "salida",
  nombre: "Gasto",
  mensajeOk: "Gasto eliminado exitosamente",
});

// <==&&==·········· IMPREVISTOS ··········==&&==>

const getImprevistos = async (req, res) => {
  const ID_usuario = req.usuario.id;
  try {
    const { rows } = await pool.query(
      `SELECT i.id_imprevistos AS id, i.monto AS monto, i.causa AS causa,
              i.fecha_registro AS fecha,
              i.id_categoria,
              i.id_dependientes,
              c.nombre AS categoria,
              d.nombre AS dependiente
       FROM imprevistos i
       INNER JOIN salida s       ON i.id_salida      = s.id_salida
       INNER JOIN movimientos m  ON s.id_movimiento  = m.id_movimiento
       LEFT  JOIN categorias c   ON i.id_categoria   = c.id_categoria
       LEFT  JOIN dependientes d ON i.id_dependientes = d.id_dependientes
       WHERE m.id_usuario = $1
       ORDER BY i.fecha_registro DESC`,
      [ID_usuario]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error en getImprevistos:", error.message);
    res.status(500).json(ERROR_500);
  }
};

const updateImprevistos = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const { id } = req.params;
  const { monto, causa, fecha_registro, id_categoria, id_dependientes } = req.body || {};

  const errorDatos = validarDatos("Imprevisto", { monto, causa, fecha_registro }, { esUpdate: true });
  if (errorDatos) return res.status(400).json({ ok: false, mensaje: errorDatos });

  try {
    const result = await pool.query(
      `UPDATE imprevistos i
          SET monto = $1,
              causa = $2,
              fecha_registro = COALESCE($3, i.fecha_registro),
              id_categoria = $4,
              id_dependientes = $5
         FROM salida s, movimientos m
        WHERE i.id_salida = s.id_salida
          AND s.id_movimiento = m.id_movimiento
          AND i.id_imprevistos = $6
          AND m.id_usuario = $7`,
      [
        aNumero(monto),
        limpiar(causa),
        normalizarFecha(fecha_registro),
        id_categoria || null,
        id_dependientes || null,
        id,
        ID_usuario,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, mensaje: "Imprevisto no encontrado o sin permisos" });
    }

    await efectoSeguro(() => verificarUmbralImprevistos(ID_usuario));

    res.status(200).json({ ok: true, mensaje: "Imprevisto actualizado exitosamente" });
  } catch (error) {
    if (responderErrorBD(res, error, "updateImprevistos")) return;
    res.status(500).json(ERROR_500);
  }
};

const deleteImprevistos = crearEliminador({
  tabla: "imprevistos",
  columnaId: "id_imprevistos",
  padre: "salida",
  nombre: "Imprevisto",
  mensajeOk: "Imprevisto eliminado exitosamente",
});

// <==&&==·········· DEUDAS ··········==&&==>

const getDeudas = async (req, res) => {
  const ID_usuario = req.usuario.id;
  try {
    const { rows } = await pool.query(
      `SELECT
              d.id_deudas AS id,
              d.monto AS monto,
              d.fuente AS fuente,
              d.descripcion AS descripcion,
              d.cuotas_total AS cuotas_total,
              d.cuotas_pagadas AS cuotas_pagadas,
              d.fecha_inicio AS fecha_inicio,
              d.fecha_fin AS fecha_fin,
              d.estado AS estado,
              d.id_categoria,
              c.nombre AS categoria
       FROM deudas d
       INNER JOIN salida s      ON d.id_salida     = s.id_salida
       INNER JOIN movimientos m ON s.id_movimiento = m.id_movimiento
       LEFT  JOIN categorias c  ON d.id_categoria  = c.id_categoria
       WHERE m.id_usuario = $1
       ORDER BY d.fecha_inicio DESC`,
      [ID_usuario]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error en getDeudas:", error.message);
    res.status(500).json(ERROR_500);
  }
};

const updateDeudas = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const { id } = req.params;
  const {
    monto, fuente, descripcion, cuotas_total, cuotas_pagadas,
    fecha_inicio, fecha_fin, estado, id_categoria,
  } = req.body || {};

  const errorDatos = validarDatos(
    "Deuda",
    { monto, fuente, descripcion, cuotas_total, fecha_inicio, fecha_fin },
    { esUpdate: true }
  );
  if (errorDatos) return res.status(400).json({ ok: false, mensaje: errorDatos });

  const cuotasTotal = cuotas_total ? Number(cuotas_total) : null;

  // cuotas_pagadas es opcional: si no llega se conserva el valor de la DB.
  const pagadasSolicitadas =
    cuotas_pagadas === undefined || cuotas_pagadas === null || cuotas_pagadas === ""
      ? null
      : Number(cuotas_pagadas);

  const errorCuotas = validarCuotasDeuda(pagadasSolicitadas, cuotasTotal);
  if (errorCuotas) return res.status(400).json({ ok: false, mensaje: errorCuotas });

  try {
    const { rows: [actual] } = await pool.query(
      `SELECT d.cuotas_pagadas
         FROM deudas d
         INNER JOIN salida s      ON d.id_salida     = s.id_salida
         INNER JOIN movimientos m ON s.id_movimiento = m.id_movimiento
        WHERE d.id_deudas = $1 AND m.id_usuario = $2`,
      [id, ID_usuario]
    );
    if (!actual) {
      return res.status(404).json({ ok: false, mensaje: "Deuda no encontrada" });
    }

    const cuotasPagadas = pagadasSolicitadas !== null
      ? pagadasSolicitadas
      : Number(actual.cuotas_pagadas);

    // Si se conservan las pagadas hay que revalidar contra el nuevo total.
    const errorCoherencia = validarCuotasDeuda(cuotasPagadas, cuotasTotal);
    if (errorCoherencia) {
      return res.status(400).json({ ok: false, mensaje: errorCoherencia });
    }

    // El estado SIEMPRE se deriva de las cuotas (fuente de verdad):
    //  - con cuotas_total: pagada ⇔ cuotas_pagadas >= cuotas_total
    //  - pago único (sin cuotas_total): pagada ⇔ cuotas_pagadas >= 1; con 0 pagadas
    //    se respeta el estado enviado solo si es 'pagada' (deudas antiguas).
    let estadoFinal;
    if (cuotasTotal !== null) {
      estadoFinal = cuotasPagadas >= cuotasTotal ? "pagada" : "pendiente";
    } else if (cuotasPagadas >= 1) {
      estadoFinal = "pagada";
    } else {
      estadoFinal = estado === "pagada" ? "pagada" : "pendiente";
    }

    await pool.query(
      `UPDATE deudas
          SET monto = $1, fuente = $2, descripcion = $3, cuotas_total = $4,
              cuotas_pagadas = $5, fecha_inicio = $6, fecha_fin = $7,
              estado = $8, id_categoria = $9
        WHERE id_deudas = $10`,
      [
        aNumero(monto),
        limpiar(fuente),
        limpiar(descripcion),
        cuotasTotal,
        cuotasPagadas,
        normalizarFecha(fecha_inicio),
        normalizarFecha(fecha_fin),
        estadoFinal,
        id_categoria || null,
        id,
      ]
    );

    await efectoSeguro(() => verificarUmbralDeudas(ID_usuario));
    await efectoSeguro(() => verificarDeudasProximasAVencer(ID_usuario));

    res.status(200).json({ ok: true, mensaje: "Deuda actualizada exitosamente" });
  } catch (error) {
    if (responderErrorBD(res, error, "updateDeudas")) return;
    res.status(500).json(ERROR_500);
  }
};

const deleteDeudas = crearEliminador({
  tabla: "deudas",
  columnaId: "id_deudas",
  padre: "salida",
  nombre: "Deuda",
  mensajeOk: "Deuda eliminada exitosamente",
  alEliminar: (ID_usuario) => verificarUmbralDeudas(ID_usuario),
});

// ─────────────────────────────────────────────────────────────
//  PATCH /movimientos/deudas/:id/abonar
//  Cada pago equivale a (monto ÷ cuotas_total) × cuotas pagadas.
//  Una deuda sin cuotas_total es un pago único (1 cuota).
// ─────────────────────────────────────────────────────────────
const abonarDeuda = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const { id } = req.params;
  const body = req.body || {};

  // Sin valor → 1 cuota. Con valor debe ser un entero >= 1 (antes "0" o "abc"
  // se convertían silenciosamente en 1).
  let cuotas = 1;
  if (body.cuotas !== undefined && body.cuotas !== null && body.cuotas !== "") {
    if (!esEnteroPositivo(body.cuotas)) {
      return res.status(400).json({
        ok: false,
        mensaje: "El número de cuotas debe ser un entero mayor o igual a 1",
      });
    }
    cuotas = Number(body.cuotas);
  }

  const errorDesc = validarTexto(body.descripcion, LIMITES.descripcion, "La descripción");
  if (errorDesc) return res.status(400).json({ ok: false, mensaje: errorDesc });
  const descripcion = limpiar(body.descripcion);

  let connection;

  try {
    connection = await pool.connect();
    await connection.query("BEGIN");

    const { rows: [deuda] } = await connection.query(
      `SELECT d.id_deudas, d.monto, d.cuotas_total, d.cuotas_pagadas, d.estado
         FROM deudas d
         INNER JOIN salida s      ON d.id_salida     = s.id_salida
         INNER JOIN movimientos m ON s.id_movimiento = m.id_movimiento
        WHERE d.id_deudas = $1 AND m.id_usuario = $2
          FOR UPDATE OF d`,
      [id, ID_usuario]
    );

    if (!deuda) {
      await connection.query("ROLLBACK");
      return res.status(404).json({ ok: false, mensaje: "Deuda no encontrada" });
    }

    if (deuda.estado === "pagada") {
      await connection.query("ROLLBACK");
      return res.status(409).json({ ok: false, mensaje: "Esta deuda ya está pagada" });
    }

    const cuotasTotal = deuda.cuotas_total !== null ? Number(deuda.cuotas_total) : 1;
    const pagadasActuales = Number(deuda.cuotas_pagadas);
    const nuevasCuotas = pagadasActuales + cuotas;

    if (nuevasCuotas > cuotasTotal) {
      await connection.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        mensaje: `Quedan ${cuotasTotal - pagadasActuales} cuota(s) por pagar.`,
      });
    }

    // Monto acumulado redondeado a centavos: la suma de todos los abonos de
    // una deuda pagada desde cero es exactamente igual al monto de la deuda.
    const monto = Number(deuda.monto);
    const acumuladoNuevo = redondear2((monto * nuevasCuotas) / cuotasTotal);
    const acumuladoPrevio = redondear2((monto * pagadasActuales) / cuotasTotal);
    const montoAbono = Math.max(redondear2(acumuladoNuevo - acumuladoPrevio), 0.01);

    await connection.query(
      `INSERT INTO abonos_deuda (id_deudas, cuotas, monto, descripcion)
       VALUES ($1, $2, $3, $4)`,
      [id, cuotas, montoAbono, descripcion]
    );

    const nuevoEstado = nuevasCuotas >= cuotasTotal ? "pagada" : "pendiente";

    await connection.query(
      `UPDATE deudas SET cuotas_pagadas = $1, estado = $2 WHERE id_deudas = $3`,
      [nuevasCuotas, nuevoEstado, id]
    );

    await connection.query("COMMIT");

    await efectoSeguro(() => verificarUmbralDeudas(ID_usuario));
    await efectoSeguro(() => verificarDeudasProximasAVencer(ID_usuario));

    return res.status(200).json({
      ok: true,
      mensaje: nuevoEstado === "pagada" ? "Deuda pagada completamente" : "Cuota registrada",
      cuotas_pagadas: nuevasCuotas,
      cuotas_total: deuda.cuotas_total,
      monto_abono: montoAbono,
      estado: nuevoEstado,
    });
  } catch (error) {
    await rollbackSeguro(connection);
    console.error("Error en abonarDeuda:", error.message);
    return res.status(500).json(ERROR_500);
  } finally {
    if (connection) connection.release();
  }
};

// ─────────────────────────────────────────────────────────────
//  PATCH /movimientos/ahorros/:id/abonar
// ─────────────────────────────────────────────────────────────
const abonarAhorro = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const ID_ahorro = req.params.id;
  const { monto } = req.body || {};

  const errorMonto = validarMonto(monto, { nombre: "El monto del abono" });
  if (errorMonto) {
    return res.status(400).json({ ok: false, mensaje: errorMonto });
  }
  const aporte = aNumero(monto);

  let connection;

  try {
    connection = await pool.connect();
    await connection.query("BEGIN");

    const { rows } = await connection.query(
      `SELECT a.id_ahorros, a.monto AS meta_monto, a.monto_acumulado, a.meta AS meta_nombre
         FROM ahorros a
         INNER JOIN entrada e     ON a.id_entrada    = e.id_entrada
         INNER JOIN movimientos m ON e.id_movimiento = m.id_movimiento
        WHERE a.id_ahorros = $1 AND m.id_usuario = $2
          FOR UPDATE OF a`,
      [ID_ahorro, ID_usuario]
    );

    if (rows.length === 0) {
      await connection.query("ROLLBACK");
      return res.status(404).json({ ok: false, mensaje: "Ahorro no encontrado" });
    }

    const ahorro = rows[0];
    const meta = Number(ahorro.meta_monto);
    const acumuladoActual = Number(ahorro.monto_acumulado);

    // Comparación en centavos para evitar errores de coma flotante.
    const restanteCent = aCentavos(meta) - aCentavos(acumuladoActual);

    if (restanteCent <= 0) {
      await connection.query("ROLLBACK");
      return res.status(400).json({ ok: false, mensaje: "La meta de ahorro ya fue alcanzada" });
    }

    if (aCentavos(aporte) > restanteCent) {
      await connection.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        mensaje: `El aporte máximo permitido es ${(restanteCent / 100).toFixed(2)}`,
      });
    }

    const aporteRedondeado = redondear2(aporte);

    await connection.query(
      `INSERT INTO abonos_ahorro (id_ahorros, monto) VALUES ($1, $2)`,
      [ID_ahorro, aporteRedondeado]
    );

    const nuevoAcumulado = redondear2(acumuladoActual + aporteRedondeado);

    await connection.query(
      `UPDATE ahorros SET monto_acumulado = $1 WHERE id_ahorros = $2`,
      [nuevoAcumulado, ID_ahorro]
    );

    await connection.query("COMMIT");

    await efectoSeguro(() => verificarMetaAhorroAlcanzada(ID_usuario, ahorro, nuevoAcumulado));
    await efectoSeguro(() => verificarUmbralAhorros(ID_usuario));

    return res.status(200).json({
      ok: true,
      mensaje: "Abono registrado correctamente",
      acumulado: nuevoAcumulado,
      meta,
      progreso: (nuevoAcumulado / meta) * 100,
      meta_alcanzada: aCentavos(nuevoAcumulado) >= aCentavos(meta),
    });
  } catch (error) {
    await rollbackSeguro(connection);
    console.error("Error en abonarAhorro:", error.message);
    return res.status(500).json(ERROR_500);
  } finally {
    if (connection) connection.release();
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /movimientos/ahorros/abonos  y  GET /movimientos/deudas/abonos
//  Historial de abonos del usuario (RF-04 y RF-07).
// ─────────────────────────────────────────────────────────────
const getAbonosAhorro = async (req, res) => {
  const ID_usuario = req.usuario.id;

  try {
    const { rows } = await pool.query(
      `SELECT aa.id_abono, aa.id_ahorros, aa.monto, aa.fecha_registro
         FROM abonos_ahorro aa
         INNER JOIN ahorros a     ON aa.id_ahorros   = a.id_ahorros
         INNER JOIN entrada e     ON a.id_entrada    = e.id_entrada
         INNER JOIN movimientos m ON e.id_movimiento = m.id_movimiento
        WHERE m.id_usuario = $1
        ORDER BY aa.fecha_registro DESC, aa.id_abono DESC`,
      [ID_usuario]
    );

    return res.status(200).json({ ok: true, datos: rows });
  } catch (error) {
    console.error("Error obteniendo abonos de ahorro:", error.message);
    return res.status(500).json(ERROR_500);
  }
};

const getAbonosDeuda = async (req, res) => {
  const ID_usuario = req.usuario.id;

  try {
    const { rows } = await pool.query(
      `SELECT ad.id_abono_deuda, ad.id_deudas, ad.cuotas, ad.monto, ad.fecha_registro, ad.descripcion
         FROM abonos_deuda ad
         INNER JOIN deudas d      ON ad.id_deudas    = d.id_deudas
         INNER JOIN salida s      ON d.id_salida     = s.id_salida
         INNER JOIN movimientos m ON s.id_movimiento = m.id_movimiento
        WHERE m.id_usuario = $1
        ORDER BY ad.fecha_registro DESC, ad.id_abono_deuda DESC`,
      [ID_usuario]
    );

    return res.status(200).json({ ok: true, datos: rows });
  } catch (error) {
    console.error("Error obteniendo abonos de deuda:", error.message);
    return res.status(500).json(ERROR_500);
  }
};

module.exports = {
  crearMovimiento,
  getIngresos,
  getAhorros,
  getGastos,
  getImprevistos,
  getDeudas,
  getAbonosAhorro,
  getAbonosDeuda,
  updateAhorros,
  updateDeudas,
  updateGastos,
  updateImprevistos,
  updateIngresos,
  deleteIngresos,
  deleteAhorros,
  deleteGastos,
  deleteImprevistos,
  deleteDeudas,
  getMovimientos,
  abonarDeuda,
  abonarAhorro,
};