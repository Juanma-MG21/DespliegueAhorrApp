//? NOTA
// arreglo de diversos alias
// arreglo de estructura corrompida
// agregacion de los rows para funcionalidad con postgresql
//! Preguntar que carajos hizo el responsable de esta vista

const pool = require('../db/connection');
const { registrarHistorial } = require('./Historialcontroller');

function validarDependiente(datos) {
  if (typeof datos.Nombre !== 'string' || !datos.Nombre.trim() ||
      typeof datos.Relacion !== 'string' || !datos.Relacion.trim()) {
    return 'Nombre y relación son requeridos';
  }
  if (datos.Nombre.trim().length > 100 || datos.Relacion.trim().length > 100) {
    return 'El nombre o la relación supera la longitud permitida';
  }
  if (!Number.isInteger(datos.Peso_economico) || datos.Peso_economico < 1 || datos.Peso_economico > 5) {
    return 'El peso económico debe ser un número entero entre 1 y 5';
  }
  if (datos.Ocupacion != null && (typeof datos.Ocupacion !== 'string' || datos.Ocupacion.trim().length > 150)) {
    return 'La ocupación debe ser texto de hasta 150 caracteres';
  }
  if (datos.Fecha_nacimiento != null && datos.Fecha_nacimiento !== '') {
    const fecha = datos.Fecha_nacimiento;
    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
        !Number.isFinite(Date.parse(fecha)) || new Date(fecha).toISOString().slice(0, 10) !== fecha) {
      return 'La fecha de nacimiento debe ser una fecha válida con formato AAAA-MM-DD';
    }
  }
  return null;
}

// ── GET: Obtener dependientes del usuario autenticado ──────
const getDependientes = async (req, res) => {
  const ID_usuario = req.usuario.id;

  try {
    const { rows: results } = await pool.query(
      `SELECT 
        id_dependientes,
        nombre AS "Nombre",
        relacion AS "Relacion",
        ocupacion AS "Ocupacion",
        fecha_nacimiento AS "Fecha_nacimiento",
        peso_economico AS "Peso_economico"
      FROM dependientes
      WHERE id_usuario = $1`,
      [ID_usuario]
    );
    res.json(results);
  } catch (err) {
    console.error('Error al obtener dependientes:', err);
    res.status(500).json({ error: 'Error al obtener dependientes' });
  }
};

// ── POST: Agregar un dependiente ───────────────────────────
const addDependiente = async (req, res) => {
  const ID_usuario = req.usuario.id;
  const { Nombre, Relacion, Ocupacion, Fecha_nacimiento, Peso_economico } = req.body || {};

  const errorValidacion = validarDependiente(req.body || {});
  if (errorValidacion) return res.status(400).json({ ok: false, error: errorValidacion, mensaje: errorValidacion });

  try {
    const { rows: result } = await pool.query(
      `INSERT INTO dependientes (id_usuario, nombre, relacion, ocupacion, fecha_nacimiento, peso_economico)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_dependientes, nombre AS "Nombre", relacion AS "Relacion",
         ocupacion AS "Ocupacion", fecha_nacimiento AS "Fecha_nacimiento", peso_economico AS "Peso_economico"`,
      [ID_usuario, Nombre.trim(), Relacion.trim(), Ocupacion?.trim() || null, Fecha_nacimiento || null, Peso_economico]
    );
    res.status(201).json({ ok: true, message: 'Dependiente agregado', id_dependientes: result[0].id_dependientes, dependiente: result[0] });
  } catch (err) {
    console.error('Error al agregar dependiente:', err);
    res.status(500).json({ error: 'Error al agregar dependiente' });
  }
};

// ── PUT: Editar un dependiente ─────────────────────────────
const updateDependiente = async (req, res) => {
  const { id } = req.params;
  const ID_usuario = req.usuario.id;
  const { Nombre, Relacion, Ocupacion, Fecha_nacimiento, Peso_economico } = req.body || {};

  const errorValidacion = validarDependiente(req.body || {});
  if (errorValidacion) return res.status(400).json({ ok: false, error: errorValidacion, mensaje: errorValidacion });

  try {
    const result = await pool.query(
      `UPDATE dependientes
        SET nombre = $1, relacion = $2, ocupacion = $3, fecha_nacimiento = $4, peso_economico = $5
       WHERE id_dependientes = $6 AND id_usuario = $7`,
      [Nombre.trim(), Relacion.trim(), Ocupacion?.trim() || null, Fecha_nacimiento || null, Peso_economico, id, ID_usuario]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Dependiente no encontrado' });
    }
    res.json({ ok: true, message: 'Dependiente actualizado' });
  } catch (err) {
    console.error('Error al actualizar dependiente:', err);
    res.status(500).json({ error: 'Error al actualizar dependiente' });
  }
};

// ── DELETE: Eliminar un dependiente ───────────────────────
const deleteDependiente = async (req, res) => {
  const { id } = req.params;
  const ID_usuario = req.usuario.id;

  try {
    const result = await pool.query(
      'DELETE FROM dependientes WHERE id_dependientes = $1 AND id_usuario = $2',
      [id, ID_usuario]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Dependiente no encontrado' });
    }

    await registrarHistorial(
      ID_usuario,
      'Eliminó un dependiente',
      `Dependiente eliminado: ID ${id}`
    );

    res.json({ ok: true, message: 'Dependiente eliminado' });
  } catch (err) {
    console.error('Error al eliminar dependiente:', err);
    res.status(500).json({ error: 'Error al eliminar dependiente' });
  }
};

// ── DELETE (admin): Eliminar el dependiente de cualquier usuario ───────────
// A diferencia de deleteDependiente, esta no filtra por id_usuario porque
// la ejecuta un admin/superuser sobre el dependiente de OTRO usuario.
const deleteDependienteAdmin = async (req, res) => {
  const { id } = req.params;

  try {
    const { rows: existe } = await pool.query(
      `SELECT id_dependientes, nombre AS "Nombre", id_usuario AS "ID_usuario"
       FROM dependientes WHERE id_dependientes = $1`,
      [id]
    );

    if (existe.length === 0) {
      return res.status(404).json({ error: 'Dependiente no encontrado' });
    }

    const dependiente = existe[0];

    await pool.query('DELETE FROM dependientes WHERE id_dependientes = $1', [id]);

    await registrarHistorial(
      req.usuario.id,
      'Eliminó el dependiente de un usuario',
      `Dependiente "${dependiente.Nombre}" (ID ${id}) perteneciente al usuario ID ${dependiente.ID_usuario}`
    );

    res.json({ ok: true, message: 'Dependiente eliminado por el administrador' });
  } catch (err) {
    console.error('Error al eliminar dependiente (admin):', err);
    res.status(500).json({ error: 'Error al eliminar dependiente' });
  }
};

module.exports = { getDependientes, addDependiente, updateDependiente, deleteDependiente, deleteDependienteAdmin };