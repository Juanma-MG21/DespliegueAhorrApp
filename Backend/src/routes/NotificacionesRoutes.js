const express = require("express");
const router = express.Router();
const { validarIdParam } = require("../middlewares/validarParams");
router.param("id", validarIdParam); // 400 si el ID no es entero (evita 500 de PostgreSQL)


const { verifyToken } = require("../middlewares/authMiddleware");
const {
  getNotificaciones,
  getNoLeidasCount,
  marcarLeida,
  marcarTodasLeidas,
  archivarNotificacion,
  eliminarNotificacion,
  getPreferenciasUsuario,
  actualizarPreferenciasUsuario,
  registrarPushToken,
} = require("../controllers/Notificacionescontroller");

router.use(verifyToken);

// ── Notificaciones ───────────────────────────────────────────
router.get("/notificaciones", getNotificaciones);
router.get("/notificaciones/no-leidas/count", getNoLeidasCount);
router.patch("/notificaciones/leer-todas", marcarTodasLeidas);
router.patch("/notificaciones/:id/leer", marcarLeida);
router.patch("/notificaciones/:id/archivar", archivarNotificacion);
router.delete("/notificaciones/:id", eliminarNotificacion);

// ── Preferencias ──────────────────────────────────────────────
router.get("/preferencias-notificacion", getPreferenciasUsuario);
router.put("/preferencias-notificacion", actualizarPreferenciasUsuario);

// ── Push tokens ──────────────────────────────────────────────
router.post("/push-tokens", registrarPushToken);


//--Ruta de prueba para crear notificaciones
// router.post("/notificaciones/test", testNotificacion);

module.exports = router;