const pool = require("../db/connection");

// ── Helper interno: registrar una acción en el historial ────────────────────
// Lo usan otros controllers (authController, dependientesController, etc.)
// para dejar constancia de acciones administrativas o del propio usuario.
// id_usuario = quien EJECUTA la acción (el actor), no necesariamente el afectado.
const registrarHistorial = async (id_usuario, accion, detalles = null) => {
  try {
    await pool.query(
      `INSERT INTO historial (id_usuario, accion, detalles) VALUES ($1, $2, $3)`,
      [id_usuario, accion, detalles]
    );
  } catch (error) {
    // Si falla el registro de historial no debe tumbar la acción principal
    // (por eso no se relanza el error ni se responde con res aquí).
    console.error("Error al registrar historial:", error.message);
  }
};

// ── GET /historial → historial completo del sistema (solo admin/superuser) ──
const getHistorial = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        h.id_historial,
        h.id_usuario AS "ID_usuario",
        u.nombre AS "usuario_nombre",
        u.apellido AS "usuario_apellido",
        h.accion,
        h.detalles,
        h.fecha
      FROM historial h
      INNER JOIN usuarios u ON h.id_usuario = u.id_usuario
      ORDER BY h.fecha DESC
    `);

    return res.status(200).json({
      ok: true,
      historial: rows,
    });
  } catch (error) {
    console.error("Error al obtener historial:", error.message);
    return res.status(500).json({
      ok: false,
      mensaje: "Error al obtener el historial",
    });
  }
};

// ── GET /historial/propio → historial del usuario logueado ──────────────────
// Pensado para la sección de Configuración: que el usuario vea su propio
// registro de acciones (ej. si desactivó su cuenta, si cambió su contraseña, etc.)
const getHistorialPropio = async (req, res) => {
  const ID_usuario = req.usuario.id;

  try {
    const { rows } = await pool.query(
      `SELECT id_historial, accion, detalles, fecha
       FROM historial
       WHERE id_usuario = $1
       ORDER BY fecha DESC`,
      [ID_usuario]
    );

    return res.status(200).json({
      ok: true,
      historial: rows,
    });
  } catch (error) {
    console.error("Error al obtener historial propio:", error.message);
    return res.status(500).json({
      ok: false,
      mensaje: "Error al obtener tu historial",
    });
  }
};

module.exports = { registrarHistorial, getHistorial, getHistorialPropio };