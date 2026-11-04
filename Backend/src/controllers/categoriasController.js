const pool = require("../db/connection");

// Mantiene los límites de la interfaz también en solicitudes directas a la API.
function validarCategoria(nombre, descripcion) {
  if (typeof nombre !== "string" || !nombre.trim()) return "El nombre es obligatorio";
  if (nombre.trim().length < 2 || nombre.trim().length > 50) return "El nombre debe tener entre 2 y 50 caracteres";
  if (descripcion != null && typeof descripcion !== "string") return "La descripción debe ser texto";
  if (descripcion?.trim().length > 200) return "La descripción no puede superar los 200 caracteres";
  return null;
}

// ── GET todas las categorías (sistema + las del usuario) ────────────────────
const getCategorias = async (req, res) => {
  const id_usuario = req.usuario.id;

  try {
    const { rows } = await pool.query(
      `SELECT 
        id_categoria AS id,
        id_usuario AS id_usuario,
        nombre AS nombre,
        descripcion AS descripcion,
        activa AS activa,
        sistema AS sistema,
        es_global AS es_global
      FROM categorias
      WHERE es_global = TRUE OR id_usuario = $1
      ORDER BY es_global DESC, nombre ASC`,
      [id_usuario]
    );

    return res.status(200).json({ ok: true, categorias: rows });
  } catch (error) {
    console.error("Error en getCategorias:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

const getGastosPorCategoria = async (req, res) => {
  const id_usuario = req.usuario.id;

  try {

    const { rows: categorias } = await pool.query(
      `SELECT
        id_categoria AS id,
        id_usuario AS id_usuario,
        nombre AS nombre,
        descripcion AS descripcion,
        activa AS activa,
        sistema AS sistema,
        es_global AS es_global
      FROM categorias
      WHERE es_global = TRUE OR id_usuario = $1
      ORDER BY es_global DESC, nombre ASC`,
      [id_usuario]
    );

    const { rows: gastos } = await pool.query(
      `SELECT
        g.id_gastos AS id,
        g.id_categoria AS id_categoria,
        g.monto AS monto,
        g.descripcion AS descripcion,
        g.fecha_registro AS fecha
      FROM gastos g
      INNER JOIN salida s ON g.id_salida = s.id_salida
      INNER JOIN movimientos m ON s.id_movimiento = m.id_movimiento
      WHERE m.id_usuario = $1
      ORDER BY g.fecha_registro DESC, g.id_gastos DESC`,
      [id_usuario]
    );

    const categoriasConGastos = categorias.map((categoria) => {
      const gastosCategoria = gastos.filter(
        (gasto) => Number(gasto.id_categoria) === Number(categoria.id)
      );

      return {
        ...categoria,
        cantidad_gastos: gastosCategoria.length,
        total_gastos: gastosCategoria.reduce(
          (total, gasto) => total + Number(gasto.monto || 0),
          0
        ),
        gastos: gastosCategoria,
      };
    });

    return res.status(200).json({ ok: true, categorias: categoriasConGastos });
  } catch (error) {
    console.error("Error en getGastosPorCategoria:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};
const getIngresosPorCategoria = async (req, res) => {
  const id_usuario = req.usuario.id;

  try {
    const { rows: categorias } = await pool.query(
      `SELECT
        id_categoria AS id,
        id_usuario AS id_usuario,
        nombre AS nombre,
        descripcion AS descripcion,
        activa AS activa,
        sistema AS sistema,
        es_global AS es_global
      FROM categorias
      WHERE es_global = TRUE OR id_usuario = $1
      ORDER BY es_global DESC, nombre ASC`,
      [id_usuario]
    );

    const { rows: ingresos } = await pool.query(
      `SELECT
        i.id_ingresos AS id,
        i.id_categoria AS id_categoria,
        i.monto AS monto,
        i.descripcion AS descripcion,
        i.fecha_registro AS fecha
      FROM ingresos i
      INNER JOIN entrada e ON i.id_entrada = e.id_entrada
      INNER JOIN movimientos m ON e.id_movimiento = m.id_movimiento
      WHERE m.id_usuario = $1
      ORDER BY i.fecha_registro DESC, i.id_ingresos DESC`,
      [id_usuario]
    );

    const categoriasConIngresos = categorias.map((categoria) => {
      const ingresosCategoria = ingresos.filter(
        (ingreso) => Number(ingreso.id_categoria) === Number(categoria.id)
      );

      return {
        ...categoria,
        cantidad_ingresos: ingresosCategoria.length,
        total_ingresos: ingresosCategoria.reduce(
          (total, ingreso) => total + Number(ingreso.monto || 0),
          0
        ),
        ingresos: ingresosCategoria,
      };
    });

    return res.status(200).json({ ok: true, categorias: categoriasConIngresos });
  } catch (error) {
    console.error("Error en getIngresosPorCategoria:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};
const getImprevistosPorCategoria = async (req, res) => {
  const id_usuario = req.usuario.id;

  try {
    const { rows: categorias } = await pool.query(
      `SELECT
        id_categoria AS id,
        id_usuario AS id_usuario,
        nombre AS nombre,
        descripcion AS descripcion,
        activa AS activa,
        sistema AS sistema,
        es_global AS es_global
      FROM categorias
      WHERE es_global = TRUE OR id_usuario = $1
      ORDER BY es_global DESC, nombre ASC`,
      [id_usuario]
    );

    const { rows: imprevistos } = await pool.query(
      `SELECT
        imp.id_imprevistos AS id,
        imp.id_categoria AS id_categoria,
        imp.monto AS monto,
        imp.causa AS descripcion,
        imp.fecha_registro AS fecha
      FROM imprevistos imp
      INNER JOIN salida s ON imp.id_salida = s.id_salida
      INNER JOIN movimientos m ON s.id_movimiento = m.id_movimiento
      WHERE m.id_usuario = $1
      ORDER BY imp.fecha_registro DESC, imp.id_imprevistos DESC`,
      [id_usuario]
    );

    const categoriasConImprevistos = categorias.map((categoria) => {
      const imprevistosCategoria = imprevistos.filter(
        (imprevisto) => Number(imprevisto.id_categoria) === Number(categoria.id)
      );

      return {
        ...categoria,
        cantidad_imprevistos: imprevistosCategoria.length,
        total_imprevistos: imprevistosCategoria.reduce(
          (total, imprevisto) => total + Number(imprevisto.monto || 0),
          0
        ),
        imprevistos: imprevistosCategoria,
      };
    });

    return res.status(200).json({ ok: true, categorias: categoriasConImprevistos });
  } catch (error) {
    console.error("Error en getImprevistosPorCategoria:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};
const getDeudasPorCategoria = async (req, res) => {
  const id_usuario = req.usuario.id;

  try {
    const { rows: categorias } = await pool.query(
      `SELECT
        id_categoria AS id,
        id_usuario AS id_usuario,
        nombre AS nombre,
        descripcion AS descripcion,
        activa AS activa,
        sistema AS sistema,
        es_global AS es_global
      FROM categorias
      WHERE es_global = TRUE OR id_usuario = $1
      ORDER BY es_global DESC, nombre ASC`,
      [id_usuario]
    );

    const { rows: deudas } = await pool.query(
      `SELECT
        d.id_deudas AS id,
        d.id_categoria AS id_categoria,
        d.monto AS monto,
        d.descripcion AS descripcion,
        d.fecha_inicio AS fecha
      FROM deudas d
      INNER JOIN salida s ON d.id_salida = s.id_salida
      INNER JOIN movimientos m ON s.id_movimiento = m.id_movimiento
      WHERE m.id_usuario = $1
      ORDER BY d.fecha_inicio DESC, d.id_deudas DESC`,
      [id_usuario]
    );

    const categoriasConDeudas = categorias.map((categoria) => {
      const deudasCategoria = deudas.filter(
        (deuda) => Number(deuda.id_categoria) === Number(categoria.id)
      );

      return {
        ...categoria,
        cantidad_deudas: deudasCategoria.length,
        total_deudas: deudasCategoria.reduce(
          (total, deuda) => total + Number(deuda.monto || 0),
          0
        ),
        deudas: deudasCategoria,
      };
    });

    return res.status(200).json({ ok: true, categorias: categoriasConDeudas });
  } catch (error) {
    console.error("Error en getDeudasPorCategoria:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};
const getAhorrosPorCategoria = async (req, res) => {
  const id_usuario = req.usuario.id;

  try {
    const { rows: categorias } = await pool.query(
      `SELECT
        id_categoria AS id,
        id_usuario AS id_usuario,
        nombre AS nombre,
        descripcion AS descripcion,
        activa AS activa,
        sistema AS sistema,
        es_global AS es_global
      FROM categorias
      WHERE es_global = TRUE OR id_usuario = $1
      ORDER BY es_global DESC, nombre ASC`,
      [id_usuario]
    );

    const { rows: ahorros } = await pool.query(
      `SELECT
        a.id_ahorros AS id,
        a.id_categoria AS id_categoria,
        a.monto AS monto,
        a.descripcion AS descripcion,
        a.fecha_registro AS fecha
      FROM ahorros a
      INNER JOIN entrada e ON a.id_entrada = e.id_entrada
      INNER JOIN movimientos m ON e.id_movimiento = m.id_movimiento
      WHERE m.id_usuario = $1
      ORDER BY a.fecha_registro DESC, a.id_ahorros DESC`,
      [id_usuario]
    );

    const categoriasConAhorros = categorias.map((categoria) => {
      const ahorrosCategoria = ahorros.filter(
        (ahorro) => Number(ahorro.id_categoria) === Number(categoria.id)
      );

      return {
        ...categoria,
        cantidad_ahorros: ahorrosCategoria.length,
        total_ahorros: ahorrosCategoria.reduce(
          (total, ahorro) => total + Number(ahorro.monto || 0),
          0
        ),
        ahorros: ahorrosCategoria,
      };
    });

    return res.status(200).json({ ok: true, categorias: categoriasConAhorros });
  } catch (error) {
    console.error("Error en getAhorrosPorCategoria:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

const crearCategoria = async (req, res) => {
  const id_usuario = req.usuario.id;
  const { nombre, descripcion } = req.body || {};

  const errorValidacion = validarCategoria(nombre, descripcion);
  if (errorValidacion) return res.status(400).json({ ok: false, mensaje: errorValidacion });

  let connection;
  try {
    connection = await pool.connect();
    await connection.query("BEGIN");
    // Serializa cambios de nombres para que dos solicitudes no creen duplicados.
    await connection.query("LOCK TABLE categorias IN SHARE ROW EXCLUSIVE MODE");
    const { rows: duplicadas } = await connection.query(
      `SELECT id_categoria FROM categorias
       WHERE (es_global = TRUE OR id_usuario = $1)
         AND LOWER(BTRIM(nombre)) = LOWER(BTRIM($2))`,
      [id_usuario, nombre.trim()]
    );
    if (duplicadas.length) {
      await connection.query("ROLLBACK");
      return res.status(409).json({ ok: false, mensaje: "Ya existe una categoría con ese nombre (activa o deshabilitada)" });
    }
    const { rows: result } = await connection.query(
      `INSERT INTO categorias (id_usuario, nombre, descripcion, activa, sistema, es_global)
       VALUES ($1, $2, $3, TRUE, FALSE, FALSE)
       RETURNING id_categoria`,
      [id_usuario, nombre.trim(), descripcion?.trim() || null]
    );

    await connection.query("COMMIT");
    return res.status(201).json({
      ok: true,
      mensaje: "Categoria creada exitosamente",
      id: result[0].id_categoria,   // antes: result.insertId
    });

  } catch (error) {
    if (connection) await connection.query("ROLLBACK");
    console.error("Error en crearCategoria:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  } finally {
    connection?.release();
  }
};

// ── PUT actualizar nombre y descripcion ─────────────────────────────────────
const actualizarCategoria = async (req, res) => {
  const id_usuario = req.usuario.id;
  const { id } = req.params;
  const { nombre, descripcion } = req.body || {};

  const errorValidacion = validarCategoria(nombre, descripcion);
  if (errorValidacion) return res.status(400).json({ ok: false, mensaje: errorValidacion });

  let connection;
  try {
    connection = await pool.connect();
    await connection.query("BEGIN");
    await connection.query("LOCK TABLE categorias IN SHARE ROW EXCLUSIVE MODE");
    const { rows } = await connection.query(
      `SELECT id_categoria FROM categorias
      WHERE id_categoria = $1 AND id_usuario = $2 AND es_global = FALSE AND sistema = FALSE`,
      [id, id_usuario]
    );

    if (rows.length === 0) {
      await connection.query("ROLLBACK");
      return res.status(403).json({ ok: false, mensaje: "No tienes permiso para editar esta categoria" });
    }

    const { rows: duplicadas } = await connection.query(
      `SELECT id_categoria FROM categorias
       WHERE (es_global = TRUE OR id_usuario = $1)
         AND LOWER(BTRIM(nombre)) = LOWER(BTRIM($2))
         AND id_categoria <> $3`,
      [id_usuario, nombre.trim(), id]
    );
    if (duplicadas.length) {
      await connection.query("ROLLBACK");
      return res.status(409).json({ ok: false, mensaje: "Ya existe una categoría con ese nombre (activa o deshabilitada)" });
    }
    await connection.query(
      "UPDATE categorias SET nombre = $1, descripcion = $2 WHERE id_categoria = $3",
      [nombre.trim(), descripcion?.trim() || null, id]
    );

    await connection.query("COMMIT");
    return res.status(200).json({ ok: true, mensaje: "Categoria actualizada exitosamente" });
  } catch (error) {
    if (connection) await connection.query("ROLLBACK");
    console.error("Error en actualizarCategoria:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  } finally {
    connection?.release();
  }
};

const deshabilitarCategoria = async (req, res) => {
  const id_usuario = req.usuario.id;
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT id_categoria FROM categorias
      WHERE id_categoria = $1 AND id_usuario = $2 AND es_global = FALSE AND sistema = FALSE`,
      [id, id_usuario]
    );

    if (rows.length === 0) {
      return res.status(403).json({ ok: false, mensaje: "No tienes permiso para deshabilitar esta categoria" });
    }

    const result = await pool.query(
      `UPDATE categorias SET activa = FALSE
       WHERE id_categoria = $1 AND id_usuario = $2 AND es_global = FALSE AND sistema = FALSE`,
      [id, id_usuario]
    );
    if (!result.rowCount) return res.status(403).json({ ok: false, mensaje: "No tienes permiso para deshabilitar esta categoria" });

    return res.status(200).json({ ok: true, mensaje: "Categoria deshabilitada" });
  } catch (error) {
    console.error("Error en deshabilitarCategoria:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

const habilitarCategoria = async (req, res) => {
  const id_usuario = req.usuario.id;
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT id_categoria FROM categorias
      WHERE id_categoria = $1 AND id_usuario = $2 AND es_global = FALSE AND sistema = FALSE`,
      [id, id_usuario]
    );

    if (rows.length === 0) {
      return res.status(403).json({ ok: false, mensaje: "No tienes permiso para habilitar esta categoria" });
    }

    const result = await pool.query(
      `UPDATE categorias SET activa = TRUE
       WHERE id_categoria = $1 AND id_usuario = $2 AND es_global = FALSE AND sistema = FALSE`,
      [id, id_usuario]
    );
    if (!result.rowCount) return res.status(403).json({ ok: false, mensaje: "No tienes permiso para habilitar esta categoria" });

    return res.status(200).json({ ok: true, mensaje: "Categoria habilitada" });
  } catch (error) {
    console.error("Error en habilitarCategoria:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// controllers/categoriasController.js
const eliminarCategoria = async (req, res) => {
  const id_usuario = req.usuario.id;
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT id_categoria, activa FROM categorias
       WHERE id_categoria = $1 AND id_usuario = $2 AND es_global = FALSE AND sistema = FALSE`,
      [id, id_usuario]
    );

    if (rows.length === 0) {
      return res.status(403).json({ ok: false, mensaje: "No tienes permiso para eliminar esta categoria" });
    }
    if (rows[0].activa) {
      return res.status(409).json({ ok: false, mensaje: "Solo puedes eliminar categorías deshabilitadas" });
    }

    const result = await pool.query(
      `DELETE FROM categorias
       WHERE id_categoria = $1 AND id_usuario = $2 AND es_global = FALSE AND sistema = FALSE AND activa = FALSE`,
      [id, id_usuario]
    );
    if (!result.rowCount) return res.status(409).json({ ok: false, mensaje: "La categoría cambió; recarga e inténtalo nuevamente" });
    return res.status(200).json({ ok: true, mensaje: "Categoria eliminada" });
  } catch (error) {
    console.error("Error en eliminarCategoria:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// agregar "eliminarCategoria" al module.exports

module.exports = {
  getCategorias,
  getGastosPorCategoria,
  getIngresosPorCategoria,
  getAhorrosPorCategoria,
  getImprevistosPorCategoria,
  getDeudasPorCategoria,
  crearCategoria,
  actualizarCategoria,
  deshabilitarCategoria,
  habilitarCategoria,
  eliminarCategoria
};