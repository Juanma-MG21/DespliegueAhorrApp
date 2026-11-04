const express = require("express");
const router = express.Router();
const { validarIdParam } = require("../middlewares/validarParams");
router.param("id", validarIdParam); // 400 si el ID no es entero (evita 500 de PostgreSQL)

const { verifyToken } = require("../middlewares/authMiddleware");
const {
    listarPerfiles,
    obtenerPerfil,
    crearPerfil,
    editarPerfil,
    eliminarPerfil,
    activarPerfil,
    abrirPeriodo,
    cerrarPeriodo,
    listarPeriodos,
    obtenerPeriodoActivo,
    ajustarIngresoPeriodo,
    actualizarIngresoRealHandler
} = require("../controllers/PresupuestosController");

// ── Perfiles de presupuesto ──────────────────────────────────
router.get   ("/",                         verifyToken, listarPerfiles);
router.get   ("/periodos",                 verifyToken, listarPeriodos);
router.get   ("/periodos/activo",          verifyToken, obtenerPeriodoActivo);
router.post  ("/periodos/abrir",           verifyToken, abrirPeriodo);
router.put   ("/periodos/cerrar",          verifyToken, cerrarPeriodo);
router.patch ("/periodos/ajustar-ingreso", verifyToken, ajustarIngresoPeriodo);
router.patch ("/periodos/actualizar-ingreso", verifyToken, actualizarIngresoRealHandler);
router.get   ("/:id",                      verifyToken, obtenerPerfil);
router.post  ("/",                         verifyToken, crearPerfil);
router.put   ("/:id",                      verifyToken, editarPerfil);
router.delete("/:id",                      verifyToken, eliminarPerfil);
router.put   ("/:id/activar",              verifyToken, activarPerfil);

module.exports = router;