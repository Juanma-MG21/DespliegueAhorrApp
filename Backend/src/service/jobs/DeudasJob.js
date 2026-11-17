const cron = require("node-cron");
const pool = require("../../db/connection");
const { verificarDeudasProximasAVencer } = require("../../service/NotificacionesService");

const iniciarJobDeudas = () => {
  cron.schedule("0 6 * * *", async () => {
    console.log("⏰ [CRON] Ejecutando revisión diaria de deudas...");
    
    try {
      // CORRECCIÓN: Buscamos los usuarios activos, NO en la tabla deudas
      const { rows: usuarios } = await pool.query(
        `SELECT id_usuario FROM usuarios WHERE activo = TRUE`
      );

      for (const { id_usuario } of usuarios) {
        await verificarDeudasProximasAVencer(id_usuario);
      }
      
      console.log("✅ [CRON] Revisión finalizada.");
    } catch (error) {
      console.error("❌ [CRON] Error:", error.message);
    }
  });
};

module.exports = { iniciarJobDeudas };