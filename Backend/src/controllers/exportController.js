const pool = require('../db/connection');
const PDFDocument = require('pdfkit');



// ============================================================
// HELPERS: Registro en Historial con Transacción
// ============================================================

/**
 * Registra una acción en la tabla historial usando una conexión existente (transacción).
 * @param {import('pg').PoolClient} connection - Conexión activa con transacción iniciada
 * @param {number} userId - ID del usuario que realiza la acción
 * @param {string} accion - Descripción breve de la acción (ej: 'EXPORTAR_REPORTE')
 * @param {string} detalles - Detalles adicionales (ej: 'Tipo: PDF, Formato: movimientos')
 * @returns {Promise<number>} ID del registro insertado
 */
const registrarEnHistorial = async (connection, userId, accion, detalles) => {
  const sqlHistorial = `
    INSERT INTO historial (id_usuario, accion, detalles, fecha)
    VALUES ($1, $2, $3, NOW())
    RETURNING id_historial
  `;
  const { rows } = await connection.query(sqlHistorial, [
    userId,
    accion,
    detalles
  ]);
  return rows[0].id_historial;
};

// ============================================================
// HELPERS: Generación de Archivos (sin cambios)
// ============================================================

// Helper: Escapa valores para CSV
const escapeCSV = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

// Helper: Genera CSV en memoria
const generateCSV = (data) => {
  if (!data || !data.length) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => escapeCSV(row[h])).join(','));
  return [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
};

// Helper: Genera PDF con pdfkit
const generatePDF = (data, tipo) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.font('Helvetica');
  
  // Título
  doc.fontSize(20).text(`Reporte de ${tipo.toUpperCase()}`, { align: 'center' });
  doc.fontSize(11).text(`Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
  doc.moveDown(2);

  if (!data || data.length === 0) {
    doc.fontSize(12).text('No se encontraron registros para exportar.', { align: 'center' });
  } else {
    const headers = Object.keys(data[0]).filter(h => 
      !h.toLowerCase().includes('password') && 
      !h.toLowerCase().includes('token')
    );
    
    const pageWidth = doc.page.width;
    const marginLeft = 40;
    const marginRight = 40;
    const availableWidth = pageWidth - marginLeft - marginRight;
    const colWidth = availableWidth / headers.length;
    
    let y = doc.y;
    const rowHeight = 20;

    // Encabezados de tabla
    doc.font('Helvetica-Bold').fontSize(10);
    headers.forEach((h, i) => {
      const x = marginLeft + i * colWidth;
      doc.text(h.replace('_', ' ').toUpperCase(), x, y, { 
        width: colWidth - 5, 
        align: 'left',
        ellipsis: true 
      });
    });
    y += rowHeight;
    
    // Línea separadora
    doc.moveTo(marginLeft, y).lineTo(pageWidth - marginRight, y).stroke();
    y += 10;

    // Datos de la tabla
    doc.font('Helvetica').fontSize(9);
    data.forEach((row, rowIndex) => {
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 50;
      }

      headers.forEach((h, i) => {
        const x = marginLeft + i * colWidth;
        let value = row[h];
        
        if (value instanceof Date) {
          value = value.toLocaleDateString('es-CO');
        } else if (typeof value === 'number' && (h.toLowerCase().includes('monto') || h.toLowerCase().includes('total'))) {
          value = `$${value.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
        } else if (value === null || value === undefined) {
          value = '-';
        } else {
          value = String(value);
        }
        
        if (value.length > 25) {
          value = value.substring(0, 25) + '...';
        }
        
        doc.text(value, x, y, { 
          width: colWidth - 5, 
          align: 'left',
          ellipsis: true 
        });
      });
      y += rowHeight;
    });
  }
  
  return doc;
};

// Configuración de consultas según tipo de dato
// (nombres de tabla/columna en minúscula, tal como quedaron en el nuevo schema de Supabase)
const getQueryConfig = (tipo) => {
  const configs = {
    ingresos: {
      table: 'ingresos',
      join: 'INNER JOIN entrada ON ingresos.id_entrada = entrada.id_entrada INNER JOIN movimientos ON entrada.id_movimiento = movimientos.id_movimiento',
      userField: 'movimientos.id_usuario',
      dateField: 'ingresos.fecha_registro',
      selectFields: 'ingresos.id_ingresos, ingresos.monto, ingresos.descripcion, ingresos.fuente, ingresos.fecha_registro'
    },
    gastos: {
      table: 'gastos',
      join: 'INNER JOIN salida ON gastos.id_salida = salida.id_salida INNER JOIN movimientos ON salida.id_movimiento = movimientos.id_movimiento',
      userField: 'movimientos.id_usuario',
      dateField: 'gastos.fecha_registro',
      selectFields: 'gastos.id_gastos, gastos.monto, gastos.descripcion, gastos.fecha_registro'
    },
    movimientos: {
      table: 'movimientos',
      join: '',
      userField: 'movimientos.id_usuario',
      dateField: null,
      selectFields: 'movimientos.id_movimiento, movimientos.tipo_flujo, movimientos.subtipo_modulo'
    },
    dependientes: {
      table: 'dependientes',
      join: '',
      userField: 'dependientes.id_usuario',
      dateField: null,
      selectFields: 'dependientes.id_dependientes, dependientes.nombre, dependientes.relacion, dependientes.ocupacion, dependientes.fecha_nacimiento, dependientes.peso_economico'
    }
  };
  return configs[tipo];
};

// ENDPOINT PRINCIPAL: Exportar con Registro en Historial

exports.exportarDatos = async (req, res) => {
  let connection;
  
  try {
    const { formato, tipo = 'movimientos', fechaInicio, fechaFin } = req.body || {};
    
    const userId = req.usuario?.id;
    if (!userId) {
      return res.status(401).json({ error: 'No hay usuario autenticado' });
    }

    // Validación
    const formatos = ['json', 'csv', 'pdf'];
    const tiposValidos = ['gastos', 'ingresos', 'movimientos', 'dependientes'];
    
    if (!formatos.includes(formato)) {
      return res.status(400).json({ error: 'Formato inválido. Use: json, csv o pdf' });
    }
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido. Use: gastos, ingresos, movimientos o dependientes' });
    }

    // Obtener configuración de consulta
    const config = getQueryConfig(tipo);
    if (!config) {
      return res.status(400).json({ error: 'Tipo de datos no soportado' });
    }

    // Construir consulta SQL (placeholders numerados $1, $2... como exige pg)
    let sql = `SELECT ${config.selectFields} FROM ${config.table}`;
    
    if (config.join) {
      sql += ` ${config.join}`;
    }

    let params = [userId];
    sql += ` WHERE ${config.userField} = $${params.length}`;

    // Agregar filtros de fecha si aplica
    if (config.dateField) {
      if (fechaInicio) {
        params.push(fechaInicio);
        sql += ` AND ${config.dateField} >= $${params.length}`;
      }
      if (fechaFin) {
        params.push(fechaFin);
        sql += ` AND ${config.dateField} <= $${params.length}`;
      }
      sql += ` ORDER BY ${config.dateField} DESC`;
    }

    // ==============================================
    // INICIAR TRANSACCIÓN para registro atómico
    // ==============================================
    connection = await pool.connect();
    await connection.query('BEGIN');

    try {
      // Ejecutar consulta principal
      const { rows } = await connection.query(sql, params);

      // Nombre del archivo
      const filename = `reporte_financiero_${new Date().toISOString().slice(0, 10)}`;

      // Construir detalles para el historial
      const detallesHistorial = JSON.stringify({
        tipo_reporte: tipo,
        formato: formato,
        cantidad_registros: rows.length,
        filtros: { fechaInicio, fechaFin },
        ruta_archivo: `/exports/${filename}.${formato}`,
        IP: req.ip || req.connection.remoteAddress
      });

      // REGISTRAR EN HISTORIAL (dentro de la transacción)
      await registrarEnHistorial(
        connection,
        userId,
        'EXPORTAR_REPORTE',
        detallesHistorial
      );

      // CONFIRMAR TRANSACCIÓN antes de enviar respuesta
      await connection.query('COMMIT');

      // Respuesta según formato
      if (formato === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.json`);
        return res.json(rows);
      }

      if (formato === 'csv') {
        const csvContent = generateCSV(rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
        return res.send(csvContent);
      }

      if (formato === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);
        const doc = generatePDF(rows, tipo);
        doc.pipe(res);
        doc.end();
        return;
      }

    } catch (queryError) {
      //ROLLBACK en caso de error en la consulta o historial
      await connection.query('ROLLBACK');
      throw queryError;
    }

  } catch (err) {
    console.error('❌ Error en exportación:', err);
    
    // Registrar error en historial si la conexión está disponible
    if (connection) {
      try {
        // Aseguramos que no haya una transacción huérfana abierta.
        // Si el ROLLBACK de arriba ya cerró la transacción, este ROLLBACK
        // adicional es un no-op seguro en Postgres.
        await connection.query('ROLLBACK').catch(() => {});
        await connection.query('BEGIN');
        const errorHistorial = JSON.stringify({
          tipo_reporte: req.body?.tipo || 'desconocido',
          formato: req.body?.formato || 'desconocido',
          error: err.message
        });
        await registrarEnHistorial(connection, req.usuario?.id, 'ERROR_EXPORTAR', errorHistorial);
        await connection.query('COMMIT');
      } catch (logError) {
        console.error('Error al registrar fallo en historial:', logError);
      }
    }
    
    res.status(500).json({ error: 'Error interno al generar el reporte.' });
  } finally {
    // Liberar conexión siempre
    if (connection) {
      connection.release();
    }
  }
};

exports.obtenerExportaciones = async (req, res) => {
  try {
    const userId = req.usuario?.id;
    if (!userId) {
      return res.status(401).json({ error: 'No hay usuario autenticado' });
    }

    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;
    const { tipo, formato } = req.query;

    let sql = "SELECT id_historial, accion, detalles, fecha FROM historial WHERE id_usuario = $1 AND accion NOT LIKE 'RF19:%'";
    const params = [userId];

    if (tipo) {
      params.push(`%"tipo_reporte":"${tipo}"%`);
      sql += ` AND detalles LIKE $${params.length}`;
    }
    if (formato) {
      params.push(`%"formato":"${formato}"%`);
      sql += ` AND detalles LIKE $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY fecha DESC LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error('❌ Error al obtener exportaciones:', err);
    return res.status(500).json({ error: 'Error interno al obtener exportaciones.' });
  }
};

exports.eliminarExportacion = async (req, res) => {
  try {
    const userId = req.usuario?.id;
    if (!userId) {
      return res.status(401).json({ error: 'No hay usuario autenticado' });
    }

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID de exportación inválido' });
    }

    const result = await pool.query(
      "DELETE FROM historial WHERE id_historial = $1 AND id_usuario = $2 AND accion NOT LIKE 'RF19:%'",
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Exportación no encontrada o no pertenece al usuario' });
    }

    return res.json({ message: 'Exportación eliminada correctamente' });
  } catch (err) {
    console.error('❌ Error al eliminar exportación:', err);
    return res.status(500).json({ error: 'Error interno al eliminar exportación.' });
  }
};

module.exports = exports;
