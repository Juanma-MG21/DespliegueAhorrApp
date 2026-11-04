const express = require("express");
const router = express.Router();
const { validarIdParam } = require("../middlewares/validarParams");
router.param("id", validarIdParam); // 400 si el ID no es entero (evita 500 de PostgreSQL)

const { verifyToken } = require("../middlewares/authMiddleware");
const {
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
} = require("../controllers/categoriasController");

router.get("/", verifyToken, getCategorias);
router.get("/gastos", verifyToken, getGastosPorCategoria);
router.get("/ingresos",    verifyToken, getIngresosPorCategoria);
router.get("/ahorros",     verifyToken, getAhorrosPorCategoria);
router.get("/imprevistos", verifyToken, getImprevistosPorCategoria);
router.get("/deudas",      verifyToken, getDeudasPorCategoria);
router.post("/", verifyToken, crearCategoria);
router.put("/:id", verifyToken, actualizarCategoria);
router.patch("/:id/deshabilitar", verifyToken, deshabilitarCategoria);
router.patch("/:id/habilitar", verifyToken, habilitarCategoria);
router.delete("/:id", verifyToken, eliminarCategoria);

module.exports = router;
