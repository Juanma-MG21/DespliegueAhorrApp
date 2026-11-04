const express = require("express");
const router = express.Router();
const { validarIdParam } = require("../middlewares/validarParams");
router.param("id", validarIdParam); // 400 si el ID no es entero (evita 500 de PostgreSQL)

const { verifyToken } = require("../middlewares/authMiddleware");
const { capacidades, consultarOperacion } = require('../controllers/sincronizacionController');
const {
  crearMovimiento,
  getIngresos,
  updateIngresos,
  deleteIngresos,
  getAhorros,
  updateAhorros,
  deleteAhorros,
  getGastos,
  updateGastos,
  deleteGastos,
  getImprevistos,
  updateImprevistos,
  deleteImprevistos,
  getDeudas,
  updateDeudas,
  deleteDeudas,
  getMovimientos,
  abonarDeuda,
  abonarAhorro,
  getAbonosAhorro,
  getAbonosDeuda,
} = require("../controllers/movimientosController");


router.post("/",          verifyToken, crearMovimiento);
router.get("/", verifyToken, getMovimientos); 
router.get("/ingresos",   verifyToken, getIngresos);
router.get("/ahorros",    verifyToken, getAhorros);
router.get("/gastos",     verifyToken, getGastos);
router.get("/imprevistos",verifyToken, getImprevistos);
router.get("/deudas",     verifyToken, getDeudas);
// Sincronización móvil (RF19). Van antes de cualquier ruta con :id.
router.get("/sincronizacion", verifyToken, capacidades);
router.get("/sincronizacion/operaciones/:operationId", verifyToken, consultarOperacion);
// Historial de abonos (RF-04 / RF-07). Se declaran antes de cualquier ruta con :id.
router.get("/ahorros/abonos", verifyToken, getAbonosAhorro);
router.get("/deudas/abonos",  verifyToken, getAbonosDeuda);
router.patch("/deudas/:id/abonar",  verifyToken, abonarDeuda);
router.patch("/ahorros/:id/abonar", verifyToken, abonarAhorro);
router.put("/ingresos/:id", verifyToken, updateIngresos);
router.put("/ahorros/:id",  verifyToken, updateAhorros);
router.put("/gastos/:id",   verifyToken, updateGastos);
router.put("/imprevistos/:id", verifyToken, updateImprevistos);
router.put("/deudas/:id",   verifyToken, updateDeudas);
router.delete("/ingresos/:id", verifyToken, deleteIngresos);
router.delete("/ahorros/:id", verifyToken, deleteAhorros);
router.delete("/gastos/:id", verifyToken, deleteGastos);
router.delete("/imprevistos/:id", verifyToken, deleteImprevistos);
router.delete("/deudas/:id", verifyToken, deleteDeudas);

module.exports = router;