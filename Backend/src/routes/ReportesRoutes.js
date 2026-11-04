const express = require("express");
const router = express.Router();
const { validarIdParam } = require("../middlewares/validarParams");
router.param("id_periodo", validarIdParam); // 400 si el ID no es entero (evita 500 de PostgreSQL)


const {
  getReporteResumen,
  getGastosPorCategoria,
  getGastosPorDependiente,
  getIngresosPorCategoria,
  getIngresosPorFuente,
  getReporteAhorros,
  getReporteDeudas,
  getImprevistosPorCategoria,
  getReporteFondoEmergencia,
  getReportePresupuesto,
  getEvolucionTemporal,
  getEstadoAhorros,
  getEstadoDeudas,
  getEstadoFondoEmergencia
} = require("../controllers/ReportesController");
const { verifyToken: authMiddleware } = require("../middlewares/authMiddleware");


router.get(
  "/resumen",
  authMiddleware,
  getReporteResumen
);


router.get(
  "/gastos/categorias",
  authMiddleware,
  getGastosPorCategoria
);


router.get(
  "/gastos/dependientes",
  authMiddleware,
  getGastosPorDependiente
);


router.get(
  "/ingresos/categorias",
  authMiddleware,
  getIngresosPorCategoria
);


router.get(
  "/ingresos/fuentes",
  authMiddleware,
  getIngresosPorFuente
);


router.get(
  "/ahorros",
  authMiddleware,
  getReporteAhorros
);


router.get(
  "/deudas",
  authMiddleware,
  getReporteDeudas
);


router.get(
  "/imprevistos/categorias",
  authMiddleware,
  getImprevistosPorCategoria
);


router.get(
  "/fondo-emergencia",
  authMiddleware,
  getReporteFondoEmergencia
);

router.get(
  "/presupuesto/:id_periodo",
  authMiddleware,
  getReportePresupuesto
);

router.get(
  "/evolucion",
  authMiddleware,
  getEvolucionTemporal
);

router.get(
  "/ahorros/estado",
  authMiddleware,
  getEstadoAhorros
);

router.get(
  "/deudas/estado",
  authMiddleware,
  getEstadoDeudas
);

router.get(
  "/fondo-emergencia/estado",
  authMiddleware,
  getEstadoFondoEmergencia
);

module.exports = router;