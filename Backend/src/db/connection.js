const { Pool } = require("pg");
require("dotenv").config();

// Configuración de conexión local para producción en AWS (Disco de 5GB)
// Se elimina la propiedad SSL ya que la base de datos corre de forma local e interna.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10, // Límite máximo de conexiones simultáneas en el pool
});

pool
  .connect()
  .then((client) => {
    console.log("Conexión a la base de datos local exitosa");
    client.release();
  })
  .catch((error) => {
    console.error("Error al conectar a la base de datos local:", error.message);
  });

module.exports = pool;
