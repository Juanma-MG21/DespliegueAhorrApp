// Validación de parámetros de ruta.
// Los IDs de la BD son enteros (SERIAL). Si llega "abc" o "1;--" a una consulta
// con $1, PostgreSQL lanza "invalid input syntax for type integer" y el
// cliente recibía un 500. Aquí se corta antes con un 400 claro.
const validarIdParam = (req, res, next, valor, nombre) => {
  const n = Number(valor);
  if (!/^\d+$/.test(String(valor)) || !Number.isSafeInteger(n) || n <= 0 || n > 2147483647) {
    return res.status(400).json({
      ok: false,
      mensaje: `El parámetro '${nombre}' debe ser un número entero positivo`,
    });
  }
  next();
};

// Uso: router.param("id", validarIdParam);
module.exports = { validarIdParam };
