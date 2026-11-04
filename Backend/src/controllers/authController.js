const pool = require("../db/connection"); 
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendResetCodeEmail } = require("../service/MailService");
const { registrarHistorial } = require("./Historialcontroller");
require("dotenv").config();

// ── Helper de errores ────────────────────────────────────────────────────────
const handleServerError = (res, error, msg) => {
  console.error(`${msg}:`, error.message);

  return res.status(500).json({
    ok: false,
    mensaje: msg,
  });
};

// ── POST /register ───────────────────────────────────────────────────────────
const register = async (req, res) => {
  const { Nombre, Apellido, Email, Password_hash } = req.body || {};

  if (!Email || !Password_hash) {
    return res.status(400).json({
      ok: false,
      mensaje: "Datos incompletos",
    });
  }

  // Antes: un Email/Password que no fuera texto hacía fallar bcrypt o la consulta (500).
  if (typeof Email !== "string" || typeof Password_hash !== "string" ||
      (Nombre != null && typeof Nombre !== "string") ||
      (Apellido != null && typeof Apellido !== "string")) {
    return res.status(400).json({
      ok: false,
      mensaje: "Los datos enviados tienen un formato inválido",
    });
  }

  try {
    const { rows: existingUser } = await pool.query(
      'SELECT id_usuario AS "ID_usuario" FROM usuarios WHERE email = $1',
      [Email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        ok: false,
        mensaje: "El correo ya está registrado",
      });
    }

    const passwordHash = await bcrypt.hash(Password_hash, 10);

    const { rows: insertResult } = await pool.query(
      `INSERT INTO usuarios (nombre, apellido, email, password_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING id_usuario AS "ID_usuario"`,
      [Nombre, Apellido, Email, passwordHash]
    );
    const result = insertResult[0]; // así result.ID_usuario queda disponible    

    // Asigna el rol por defecto (ID_rol = 1 → "user") al usuario recién creado
    
    await pool.query(
      "INSERT INTO usuarios_roles (id_usuario, id_rol) VALUES ($1, $2)",
      [result.ID_usuario, 1] // antes era result.insertId
    );

    return res.status(201).json({
      ok: true,
      mensaje: "Usuario registrado exitosamente",
      id: result.ID_usuario, // antes era
      // id: result.insertId, 
    });

  } catch (error) {
    return handleServerError(res, error, "Error en registro");
  }
};

// ── POST /login ──────────────────────────────────────────────────────────────
const login = async (req, res) => {
  const { Email, Password_hash } = req.body || {};

  try {

    const { rows } = await pool.query(
      "SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE",
      [Email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        ok: false,
        mensaje: "Correo o contraseña incorrectos",
      });
    }

    const usuario = rows[0];

    const passwordValida = await bcrypt.compare(
      Password_hash,
      usuario.password_hash          // antes: usuario.Password_hash
    );

    if (!passwordValida) {
      return res.status(401).json({
        ok: false,
        mensaje: "Correo o contraseña incorrectos",
      });
    }

    const { rows: rolesRows } = await pool.query(
      `SELECT r.cargo AS "Cargo"
      FROM usuarios_roles ur
      INNER JOIN rol r ON ur.id_rol = r.id_rol
      WHERE ur.id_usuario = $1`,
      [usuario.id_usuario]           // antes: usuario.ID_usuario
    );

    const roles = rolesRows.map((fila) => fila.Cargo.toLowerCase());

    const token = jwt.sign(
      {
        id: usuario.id_usuario,      // antes: usuario.ID_usuario
        roles,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.status(200).json({
      ok: true,
      mensaje: "Inicio de sesión exitoso",
      token,
      usuario: {
        id: usuario.id_usuario,      // antes: usuario.ID_usuario
        nombre: usuario.nombre,      // antes: usuario.Nombre
        apellido: usuario.apellido,  // antes: usuario.Apellido
        email: usuario.email,        // antes: usuario.Email
        roles,
      },
    });

  } catch (error) {
    return handleServerError(res, error, "Error en login");
  }
};

// ── POST /forgot-password ────────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  const Email = String(req.body.Email ?? req.body.email ?? '').trim();

  if (!Email) {
    return res.status(400).json({
      ok: false,
      mensaje: "El correo es requerido",
    });
  }

  try {
    
    const { rows } = await pool.query(
      'SELECT id_usuario AS "ID_usuario", email AS "Email" FROM usuarios WHERE email = $1 AND activo = TRUE',
      [Email]
    );

    // Respuesta genérica aunque no exista el usuario (evita enumeración de emails)
    if (rows.length === 0) {
      return res.status(200).json({
        ok: true,
        mensaje: "Si el correo está registrado, recibirás un código de verificación",
      });
    }

    const usuario = rows[0];

    const code = crypto.randomInt(100000, 999999).toString();
    const hashedCode = await bcrypt.hash(code, 10);
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    await pool.query(
      "UPDATE usuarios SET reset_code = $1, reset_code_expires = $2 WHERE id_usuario = $3",
      [hashedCode, expires, usuario.ID_usuario]
    );

    await sendResetCodeEmail(usuario.Email, code);

    return res.status(200).json({
      ok: true,
      mensaje: "Si el correo está registrado, recibirás un código de verificación",
    });

  } catch (error) {
    return handleServerError(res, error, "Error al procesar la solicitud de recuperación");
  }
};

// ── POST /verify-reset-code ──────────────────────────────────────────────────
const verifyResetCode = async (req, res) => {
  const { Email, code } = req.body || {};

  if (!Email || !code) {
    return res.status(400).json({
      ok: false,
      mensaje: "Todos los campos son requeridos",
    });
  }

  try {

    const { rows } = await pool.query(
      `SELECT
        id_usuario AS "ID_usuario",
        reset_code AS "Reset_code",
        reset_code_expires AS "Reset_code_expires"
      FROM usuarios WHERE email = $1`,
      [Email]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        ok: false,
        mensaje: "Código inválido o expirado",
      });
    }

    const usuario = rows[0];

    if (!usuario.Reset_code || !usuario.Reset_code_expires) {
      return res.status(400).json({
        ok: false,
        mensaje: "Código inválido o expirado",
      });
    }

    if (new Date() > new Date(usuario.Reset_code_expires)) {

    await pool.query(
      "UPDATE usuarios SET reset_code = NULL, reset_code_expires = NULL WHERE id_usuario = $1",
      [usuario.ID_usuario]
    );

      return res.status(400).json({
        ok: false,
        mensaje: "El código ha expirado",
      });
    }

    const codigoValido = await bcrypt.compare(code, usuario.Reset_code);

    if (!codigoValido) {
      return res.status(400).json({
        ok: false,
        mensaje: "Código inválido",
      });
    }

    // Código correcto: se invalida para que no pueda reutilizarse

    await pool.query(
      "UPDATE usuarios SET reset_code = NULL, reset_code_expires = NULL WHERE id_usuario = $1",
      [usuario.ID_usuario]
    );

    // Token temporal que prueba que el usuario ya pasó la verificación
    const resetToken = jwt.sign(
      { id: usuario.ID_usuario, purpose: "reset_password" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    return res.status(200).json({
      ok: true,
      mensaje: "Código verificado correctamente",
      resetToken,
    });

  } catch (error) {
    return handleServerError(res, error, "Error al verificar el código");
  }
};

// ── POST /reset-password ─────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  const { resetToken, nuevaPassword } = req.body || {};

  if (!resetToken || !nuevaPassword) {
    return res.status(400).json({
      ok: false,
      mensaje: "Todos los campos son requeridos",
    });
  }

  if (nuevaPassword.length < 8) {
    return res.status(400).json({
      ok: false,
      mensaje: "La contraseña debe tener al menos 8 caracteres",
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({
      ok: false,
      mensaje: "El proceso de recuperación expiró, solicita un nuevo código",
    });
  }

  if (decoded.purpose !== "reset_password") {
    return res.status(401).json({
      ok: false,
      mensaje: "Token inválido",
    });
  }

  try {

    const { rows } = await pool.query(
      'SELECT id_usuario AS "ID_usuario" FROM usuarios WHERE id_usuario = $1 AND activo = TRUE',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: "Usuario no encontrado",
      });
    }

    const passwordHash = await bcrypt.hash(nuevaPassword, 10);

    await pool.query(
      "UPDATE usuarios SET password_hash = $1 WHERE id_usuario = $2",
      [passwordHash, decoded.id]
    );
    return res.status(200).json({
      ok: true,
      mensaje: "Contraseña actualizada exitosamente",
    });

  } catch (error) {
    return handleServerError(res, error, "Error al restablecer la contraseña");
  }
};

// ── GET /PanelUsuarios ───────────────────────────────────────────────────────
const getUsuarios = async (req, res) => {
  try {

    const { rows } = await pool.query(`
      SELECT
        u.id_usuario AS "ID_usuario",
        u.nombre AS "Nombre",
        u.apellido AS "Apellido",
        u.email AS "Email",
        u.activo AS "Activo",
        r.id_rol AS "ID_rol",
        r.cargo AS "Cargo"
      FROM usuarios u
      LEFT JOIN usuarios_roles ur ON u.id_usuario = ur.id_usuario
      LEFT JOIN rol r ON ur.id_rol = r.id_rol
      WHERE u.activo = TRUE
    `);

    return res.status(200).json({
      ok: true,
      cantidad: rows.length,
      usuarios: rows,
    });

  } catch (error) {
    return handleServerError(res, error, "Error al obtener usuarios");
  }
};

// ── PUT /PanelUsuarios/:id ───────────────────────────────────────────────────
const updateUsuario = async (req, res) => {
  const { id } = req.params;
  const { Nombre, Apellido, Email } = req.body || {};

  try {
    if (!id || isNaN(id)) {
      return res.status(400).json({
        ok: false,
        mensaje: "ID inválido",
      });
    }

    const { rows: existe } = await pool.query(
      'SELECT id_usuario AS "ID_usuario" FROM usuarios WHERE id_usuario = $1',
      [id]
    );

    if (existe.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: "Usuario no encontrado",
      });
    }


    await pool.query(
      `UPDATE usuarios
      SET nombre = $1, apellido = $2, email = $3
      WHERE id_usuario = $4`,
      [Nombre, Apellido, Email, id]
    );

    return res.status(200).json({
      ok: true,
      mensaje: "Usuario actualizado exitosamente",
    });

  } catch (error) {
    return handleServerError(res, error, "Error al actualizar usuario");
  }
};

// ── PUT /PanelUsuarios/:id/rol (solo superuser) ──────────────────────────────
const actualizarRolUsuario = async (req, res) => {
  const { id } = req.params;
  const { ID_rol } = req.body || {};

  try {
    if (!id || isNaN(id)) {
      return res.status(400).json({
        ok: false,
        mensaje: "ID inválido",
      });
    }

    if (!ID_rol) {
      return res.status(400).json({
        ok: false,
        mensaje: "Debes indicar el rol",
      });
    }


    const { rows: existe } = await pool.query(
      'SELECT id_usuario AS "ID_usuario" FROM usuarios WHERE id_usuario = $1',
      [id]
    );

    if (existe.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: "Usuario no encontrado",
      });
    }

    const { rows: rolExiste } = await pool.query(
      'SELECT id_rol AS "ID_rol" FROM rol WHERE id_rol = $1',
      [ID_rol]
    );

    if (rolExiste.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: "El rol indicado no existe",
      });
    }

    await pool.query(
      "UPDATE usuarios_roles SET id_rol = $1 WHERE id_usuario = $2",
      [ID_rol, id]
    );

    await registrarHistorial(
      req.usuario.id,
      "Actualizó el rol de un usuario",
      `Usuario ID ${id} → nuevo rol: ${rolExiste[0].ID_rol}`
    );

    return res.status(200).json({
      ok: true,
      mensaje: "Rol actualizado exitosamente",
    });

  } catch (error) {
    return handleServerError(res, error, "Error al actualizar el rol");
  }
};
// ── DELETE /PanelUsuarios/:id ────────────────────────────────────────────────
const deleteUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id || isNaN(id)) {
      return res.status(400).json({
        ok: false,
        mensaje: "ID inválido",
      });
    }


    const { rows: existe } = await pool.query(
      'SELECT id_usuario AS "ID_usuario" FROM usuarios WHERE id_usuario = $1',
      [id]
    );

    if (existe.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: "Usuario no encontrado",
      });
    }

    await pool.query(
      "UPDATE usuarios SET activo = FALSE WHERE id_usuario = $1",
      [id]
    );

    await registrarHistorial(
      req.usuario.id,
      "Eliminó un usuario",
      `Usuario eliminado: ID ${id}`
    );

    return res.status(200).json({
      ok: true,
      mensaje: "Usuario eliminado exitosamente",
    });

  } catch (error) {
    return handleServerError(res, error, "Error al eliminar usuario");
  }
};
// ── GetUsuariosPanelAdmin/PanelAdmin/:id ────────────────────────────────────────────────
const getUsuariosPanelAdmin = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS "totalUsuarios" FROM usuarios'
    );
    res.json({
      totalUsuarios: rows.length > 0 ? rows[0].totalUsuarios : 0,
    })
  } catch (error){
    console.error('Error al contar usuarios:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener usuarios'
    });
  }
};

const getDependientesPanelAdmin = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS "totalDependientes" FROM dependientes'
    );
    res.json ({
      totalDependientes: rows.length > 0 ? rows [0].totalDependientes : 0,
    })
  } catch (error){
    console.error('Error al contar dependientes:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener dependientes'
    });
  }
};

const getTodosDependientesAdmin = async (req, res) => {
  try {
    console.log('Entró a PanelDependientes');

    const { rows } = await pool.query(`
      SELECT
        d.id_dependientes AS "id_dependientes",
        d.nombre AS "Nombre",
        d.relacion AS "Relacion",
        d.ocupacion AS "Ocupacion",
        d.fecha_nacimiento AS "Fecha_nacimiento",
        d.id_usuario AS "ID_usuario",
        u.nombre AS "usuario_nombre"
      FROM dependientes d
      INNER JOIN usuarios u ON d.id_usuario = u.id_usuario
      ORDER BY u.nombre, d.nombre
    `);

    console.log('Dependientes encontrados:', rows);

    return res.json({
      ok: true,
      dependientes: rows,
    });

  } catch (error) {
    console.error('Error al obtener dependientes:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener dependientes'
    });
  }
};


// ── PUT /mi-cuenta/desactivar (autoservicio, cualquier usuario) ─────────────
const desactivarCuentaPropia = async (req, res) => {
  const ID_usuario = req.usuario.id;

  try {
    const fechaEliminacion = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

    await pool.query(
      `UPDATE usuarios
       SET activo = FALSE, fecha_eliminacion_programada = $1
       WHERE id_usuario = $2`,
      [fechaEliminacion, ID_usuario]
    );

    const fechaLegible = fechaEliminacion.toISOString().slice(0, 10);

    await registrarHistorial(
      ID_usuario,
      "Desactivó su cuenta",
      `La cuenta quedará eliminada de forma permanente el ${fechaLegible} si no se reactiva antes`
    );

    return res.status(200).json({
      ok: true,
      mensaje: `Tu cuenta ha sido desactivada. Si no la reactivas antes, será eliminada de forma permanente el ${fechaLegible}.`,
      fecha_eliminacion_programada: fechaEliminacion,
    });

  } catch (error) {
    return handleServerError(res, error, "Error al desactivar la cuenta");
  }
};

const NOMBRE_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

// ── PUT /mi-perfil (autoservicio: editar mis propios datos) ─────────────────
const actualizarMiPerfil = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const { Nombre, Apellido, Email } = req.body || {};

  // Antes: si llegaba un número u objeto, .trim() lanzaba TypeError fuera del
  // try y la petición quedaba colgada sin respuesta.
  if (typeof Nombre !== "string" || typeof Apellido !== "string" || typeof Email !== "string") {
    return res.status(400).json({
      ok: false,
      mensaje: "Completa todos los campos",
    });
  }

  if (!Nombre.trim() || !Apellido.trim() || !Email.trim()) {
    return res.status(400).json({
      ok: false,
      mensaje: "Completa todos los campos",
    });
  }

  if (!NOMBRE_REGEX.test(Nombre.trim()) || !NOMBRE_REGEX.test(Apellido.trim())) {
    return res.status(400).json({
      ok: false,
      mensaje: "El nombre y el apellido solo pueden contener letras",
    });
  }

  if (!EMAIL_REGEX.test(Email.trim())) {
    return res.status(400).json({
      ok: false,
      mensaje: "Ingresa un correo electrónico válido",
    });
  }

  try {
    // El correo debe seguir siendo único, pero sin chocar consigo mismo
    const { rows: correoEnUso } = await pool.query(
      'SELECT id_usuario AS "ID_usuario" FROM usuarios WHERE email = $1 AND id_usuario <> $2',
      [Email.trim(), ID_usuario]
    );

    if (correoEnUso.length > 0) {
      return res.status(400).json({
        ok: false,
        mensaje: "Ese correo ya está en uso por otra cuenta",
      });
    }

    await pool.query(
      `UPDATE usuarios
       SET nombre = $1, apellido = $2, email = $3
       WHERE id_usuario = $4`,
      [Nombre.trim(), Apellido.trim(), Email.trim(), ID_usuario]
    );

    await registrarHistorial(ID_usuario, "Actualizó sus datos personales");

    return res.status(200).json({
      ok: true,
      mensaje: "Tus datos se actualizaron correctamente",
    });

  } catch (error) {
    return handleServerError(res, error, "Error al actualizar tus datos");
  }
};

// ── PUT /mi-cuenta/password (autoservicio: cambiar mi contraseña) ───────────
const cambiarMiPassword = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const { passwordActual, passwordNueva } = req.body || {};

  if (!passwordActual || !passwordNueva ||
      typeof passwordActual !== "string" || typeof passwordNueva !== "string") {
    return res.status(400).json({
      ok: false,
      mensaje: "Todos los campos son requeridos",
    });
  }

  if (passwordNueva.length < 8) {
    return res.status(400).json({
      ok: false,
      mensaje: "La nueva contraseña debe tener al menos 8 caracteres",
    });
  }

  try {
    const { rows } = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id_usuario = $1',
      [ID_usuario]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: "Usuario no encontrado",
      });
    }

    const passwordValida = await bcrypt.compare(passwordActual, rows[0].password_hash);

    if (!passwordValida) {
      // 400 y no 401: el web (fetchJSON) interpreta 401 como "sesión expirada"
      // y cerraba la sesión del usuario por equivocarse al escribir su contraseña.
      return res.status(400).json({
        ok: false,
        mensaje: "La contraseña actual es incorrecta",
      });
    }

    const nuevoHash = await bcrypt.hash(passwordNueva, 10);

    await pool.query(
      "UPDATE usuarios SET password_hash = $1 WHERE id_usuario = $2",
      [nuevoHash, ID_usuario]
    );

    await registrarHistorial(ID_usuario, "Cambió su contraseña");

    return res.status(200).json({
      ok: true,
      mensaje: "Contraseña actualizada correctamente",
    });

  } catch (error) {
    return handleServerError(res, error, "Error al cambiar la contraseña");
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  getUsuarios,
  updateUsuario,
  deleteUsuario,
  getUsuariosPanelAdmin,
  getDependientesPanelAdmin, 
  getTodosDependientesAdmin,
  actualizarRolUsuario,
  desactivarCuentaPropia,
  actualizarMiPerfil,
  cambiarMiPassword,
};