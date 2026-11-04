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

// Orígenes permitidos: los de desarrollo + los que se definan en CORS_ORIGINS
// (separados por coma), p. ej. la URL donde se despliega el frontend web.
const ORIGENES_CORS = [
    "https://localhost:5173",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    ...(process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean),
];

app.use(cors({
    origin: ORIGENES_CORS,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// ================================
// RUTAS
// ================================
app.use("/api/ai", aiRoutes);
// app.use("/api/alphaVantageRoutes", alphaVantageRoutes);
app.use("/api", alphaVantageRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/categorias", categoriasRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/dependientes", dependientesRoutes);
// app.use("/api/exportRoutes", exportRoutes);
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
        mensaje: "Servidor AhorrApp corriendo"
    });
});

// ================================
// 404 Y MANEJO GLOBAL DE ERRORES (siempre JSON { ok, mensaje })
// ================================

app.use((req, res) => {
    res.status(404).json({ ok: false, mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    // JSON mal formado en el body -> 400 (antes Express respondía HTML)
    if (err && (err.type === "entity.parse.failed" || err instanceof SyntaxError)) {
        return res.status(400).json({ ok: false, mensaje: "El cuerpo de la petición no es un JSON válido" });
    }
    if (err && err.type === "entity.too.large") {
        return res.status(413).json({ ok: false, mensaje: "El cuerpo de la petición es demasiado grande" });
    }
    console.error("Error no controlado:", err && err.message);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
});

// Evita que una promesa rechazada sin capturar tumbe el proceso (500 en cadena)
process.on("unhandledRejection", (motivo) => {
    console.error("unhandledRejection:", motivo && motivo.message ? motivo.message : motivo);
});

// ================================
// SERVIDOR
// ================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor AhorrApp ejecutándose en el puerto ${PORT}`);

    iniciarEliminacionCuentasJob();
    iniciarVencimientosJob();
    iniciarUmbralesJob();
});