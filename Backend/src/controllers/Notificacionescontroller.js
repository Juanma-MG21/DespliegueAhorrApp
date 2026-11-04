const pool = require("../db/connection");
const {
  getPreferencias,
  setPreferencia,
  TIPOS_NOTIFICACION,
} = require("../service/NotificacionesService")

// ─────────────────────────────────────────────────────────────
//  GET /api/notificaciones
// ─────────────────────────────────────────────────────────────
const getNotificaciones = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const { leida, archivada } = req.query;

  const page  = Math.max(parseInt(req.query.page, 10)  || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  try {
    const params = [ID_usuario];
    const condiciones = ["id_usuario = $1"];

    if (leida === "true" || leida === "false") {
      params.push(leida === "true");
      condiciones.push(`leida = $${params.length}`);
    }

    if (archivada === "true" || archivada === "false") {
      params.push(archivada === "true");
      condiciones.push(`archivada = $${params.length}`);
    } else {
      condiciones.push("archivada = FALSE");
    }

    const where = condiciones.join(" AND ");

    const { rows } = await pool.query(
      `SELECT
         id_notificacion AS id,
         tipo            AS tipo,
         entidad_tipo    AS entidad_tipo,
         entidad_id      AS entidad_id,
         mensaje         AS mensaje,
         fecha           AS fecha,
         leida           AS leida,
         archivada       AS archivada
       FROM notificaciones
       WHERE ${where}
       ORDER BY fecha DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM notificaciones WHERE ${where}`,
      params
    );

    return res.status(200).json({
      ok: true,
      notificaciones: rows,
      paginacion: { page, limit, total, totalPaginas: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error en getNotificaciones:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/notificaciones/no-leidas/count
// ─────────────────────────────────────────────────────────────
const getNoLeidasCount = async (req, res) => {
  const ID_usuario = req.usuario.id;

  try {
    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM notificaciones
       WHERE id_usuario = $1 AND leida = FALSE AND archivada = FALSE`,
      [ID_usuario]
    );

    return res.status(200).json({ ok: true, count: total });
  } catch (error) {
    console.error("Error en getNoLeidasCount:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// ─────────────────────────────────────────────────────────────
//  PATCH /api/notificaciones/:id/leer
// ─────────────────────────────────────────────────────────────
const marcarLeida = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE notificaciones SET leida = TRUE
       WHERE id_notificacion = $1 AND id_usuario = $2`,
      [id, ID_usuario]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, mensaje: "Notificación no encontrada" });
    }

    return res.status(200).json({ ok: true, mensaje: "Notificación marcada como leída" });
  } catch (error) {
    console.error("Error en marcarLeida:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// ─────────────────────────────────────────────────────────────
//  PATCH /api/notificaciones/leer-todas
// ─────────────────────────────────────────────────────────────
const marcarTodasLeidas = async (req, res) => {
  const ID_usuario = req.usuario.id;

  try {
    await pool.query(
      `UPDATE notificaciones SET leida = TRUE
       WHERE id_usuario = $1 AND leida = FALSE`,
      [ID_usuario]
    );

    return res.status(200).json({ ok: true, mensaje: "Todas las notificaciones marcadas como leídas" });
  } catch (error) {
    console.error("Error en marcarTodasLeidas:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// ─────────────────────────────────────────────────────────────
//  PATCH /api/notificaciones/:id/archivar
// ─────────────────────────────────────────────────────────────
const archivarNotificacion = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE notificaciones SET archivada = TRUE
       WHERE id_notificacion = $1 AND id_usuario = $2`,
      [id, ID_usuario]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, mensaje: "Notificación no encontrada" });
    }

    return res.status(200).json({ ok: true, mensaje: "Notificación archivada" });
  } catch (error) {
    console.error("Error en archivarNotificacion:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// ─────────────────────────────────────────────────────────────
//  DELETE /api/notificaciones/:id
// ─────────────────────────────────────────────────────────────
const eliminarNotificacion = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM notificaciones WHERE id_notificacion = $1 AND id_usuario = $2`,
      [id, ID_usuario]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, mensaje: "Notificación no encontrada" });
    }

    return res.status(200).json({ ok: true, mensaje: "Notificación eliminada" });
  } catch (error) {
    console.error("Error en eliminarNotificacion:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/preferencias-notificacion
// ─────────────────────────────────────────────────────────────
const getPreferenciasUsuario = async (req, res) => {
  const ID_usuario = req.usuario.id;

  try {
    const preferencias = await getPreferencias(ID_usuario);
    return res.status(200).json({ ok: true, preferencias });
  } catch (error) {
    console.error("Error en getPreferenciasUsuario:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// ─────────────────────────────────────────────────────────────
//  PUT /api/preferencias-notificacion
//  Body esperado: { preferencias: [{ tipo, activa }, ...] }
// ─────────────────────────────────────────────────────────────
const actualizarPreferenciasUsuario = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const { preferencias } = req.body || {};

  if (!Array.isArray(preferencias) || preferencias.length === 0) {
    return res.status(400).json({ ok: false, mensaje: "Debes enviar al menos una preferencia" });
  }

  const invalida = preferencias.find((p) => !TIPOS_NOTIFICACION.includes(p.tipo));
  if (invalida) {
    return res.status(400).json({
      ok: false,
      mensaje: `Tipo de notificación inválido: ${invalida.tipo}`,
    });
  }

  try {
    for (const { tipo, activa } of preferencias) {
      await setPreferencia(ID_usuario, tipo, Boolean(activa));
    }

    return res.status(200).json({ ok: true, mensaje: "Preferencias actualizadas" });
  } catch (error) {
    console.error("Error en actualizarPreferenciasUsuario:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

const registrarPushToken = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const { fcm_token, plataforma } = req.body || {};

  if (!fcm_token || !plataforma) {
    return res.status(400).json({ ok: false, mensaje: "fcm_token y plataforma son requeridos" });
  }

  try {
    await pool.query(
      `INSERT INTO push_tokens (id_usuario, fcm_token, plataforma)
       VALUES ($1, $2, $3)
       ON CONFLICT (fcm_token) DO UPDATE SET id_usuario = $1, plataforma = $3`,
      [ID_usuario, fcm_token, plataforma]
    );

    return res.status(200).json({ ok: true, mensaje: "Token registrado" });
  } catch (error) {
    console.error("Error en registrarPushToken:", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

module.exports = {
  getNotificaciones,
  getNoLeidasCount,
  marcarLeida,
  marcarTodasLeidas,
  archivarNotificacion,
  eliminarNotificacion,
  getPreferenciasUsuario,
  actualizarPreferenciasUsuario,
  registrarPushToken,
};