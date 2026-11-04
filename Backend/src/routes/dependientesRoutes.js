const express = require('express');
const router = express.Router();
const { validarIdParam } = require("../middlewares/validarParams");
router.param("id", validarIdParam); // 400 si el ID no es entero (evita 500 de PostgreSQL)

const { getDependientes, addDependiente, updateDependiente, deleteDependiente, deleteDependienteAdmin } = require('../controllers/dependientesController');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');


router.get('/',     verifyToken, getDependientes);
router.post('/',    verifyToken, addDependiente);
router.put('/:id',  verifyToken, updateDependiente);
router.delete('/:id', verifyToken, deleteDependiente);

// Admin/superuser: eliminar el dependiente de cualquier usuario
router.delete('/admin/:id', verifyToken, requireRole(['admin', 'superuser']), deleteDependienteAdmin);


module.exports = router;