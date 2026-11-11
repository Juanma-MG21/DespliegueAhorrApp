const express = require("express");
const cors = require("cors");
require("dotenv").config();

const aiRoutes = require("./src/routes/aiRoutes");
const alphaVantageRoutes = require("./src/routes/alphaVantageRoutes");
const authRoutes = require("./src/routes/authRoutes");
const categoriasRoutes = require("./src/routes/categoriasRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const dependientesRoutes = require("./src/routes/dependientesRoutes");
// const exportRoutes= require("./src/routes/exportRoutes");
const movimientosRoutes = require("./src/routes/movimientosRoutes");
const noticiasRoutes = require("./src/routes/noticiasRoutes");
const NotificacionesRoutes = require("./src/routes/NotificacionesRoutes");
const PresupuestosRoutes = require("./src/routes/PresupuestosRoutes");
const fondoemergenciaRoutes = require("./src/routes/fondoemergenciaRoutes");
const ReportesRoutes = require("./src/routes/ReportesRoutes");
const historialRoutes = require("./src/routes/Historialroutes");

const { iniciarEliminacionCuentasJob } = require("./src/service/jobs/EliminacioncuentasJob");
const { iniciarVencimientosJob } = require("./src/service/jobs/VencimientosJob");
const { iniciarUmbralesJob } = require("./src/service/jobs/UmbralesJob");

const app = express();

// ================================
// MIDDLEWARES
// ================================

// En producción con Nginx como Proxy inverso, el origen es local, pero permitimos
// comodines o variables configuradas para evitar conflictos de red.
const ORIGENES_CORS = [
    "https://localhost:5173",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    ...(process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean),
];

// Si estás en producción pura detrás de Nginx, puedes usar cors() abierto o mantener tu arreglo.
// Dejamos soporte abierto para simplificar el tráfico local interno.
app.use(cors({
    origin: process.env.NODE_ENV === "production" ? true : ORIGENES_CORS,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// ================================
// RUTAS
// ================================
app.use("/api/ai", aiRoutes);
app.use("/api", alphaVantageRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/categorias", categoriasRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/dependientes", dependientesRoutes);
app.use("/api/movimientos", movimientosRoutes);
app.use("/api/noticias", noticiasRoutes);
app.use("/api", NotificacionesRoutes);
app.use("/api/presupuestos", PresupuestosRoutes);
app.use("/api/fondo-emergencia", fondoemergenciaRoutes);
app.use("/api/reportes", ReportesRoutes);
app.use("/api/historial", historialRoutes);

// ================================
// RUTA DE PRUEBA
// ================================
app.get("/", (req, res) => {
    res.json({
        ok: true,
        mensaje: "Servidor AhorrApp corriendo en AWS"
    });
});

// ================================
// 404 Y MANEJO GLOBAL DE ERRORES
// ================================
app.use((req, res) => {
    res.status(404).json({ ok: false, mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
    if (err && (err.type === "entity.parse.failed" || err instanceof SyntaxError)) {
        return res.status(400).json({ ok: false, mensaje: "El cuerpo de la petición no es un JSON válido" });
    }
    if (err && err.type === "entity.too.large") {
        return res.status(413).json({ ok: false, mensaje: "El cuerpo de la petición es demasiado grande" });
    }
    console.error("Error no controlado:", err && err.message);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
});

process.on("unhandledRejection", (motivo) => {
    console.error("unhandledRejection:", motivo && motivo.message ? motivo.message : motivo);
});

// ================================
// SERVIDOR
// ================================
const PORT = process.env.PORT || 5000; // Por defecto el puerto 5000 asignado en el proxy

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor AhorrApp ejecutándose en el puerto ${PORT}`);

    // Tareas en segundo plano (Cron Jobs)
    iniciarEliminacionCuentasJob();
    iniciarVencimientosJob();
    iniciarUmbralesJob();
});
