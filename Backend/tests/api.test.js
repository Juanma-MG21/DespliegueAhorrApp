const request = require('supertest');
const app = require('../app'); // Subimos un nivel para encontrar app.js

describe('Pruebas Básicas de la API - AhorrApp', () => {

    // 1. Prueba de la ruta raíz
    test('GET / debería responder 200 y un mensaje de bienvenida', async () => {
        const response = await request(app).get('/');
        
        expect(response.statusCode).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(response.body.mensaje).toBe("Servidor AhorrApp corriendo");
    });

    // 2. Prueba de ruta inexistente (404)
    test('GET /api/ruta-inexistente debería responder 404', async () => {
        const response = await request(app).get('/api/ruta-inexistente');
        expect(response.statusCode).toBe(404);
    });

    // 3. Prueba de ruta protegida (sin token)
    test('GET /api/notificaciones sin token debería dar error 401 o 403', async () => {
        const response = await request(app).get('/api/notificaciones');
        
        // Dependiendo de cómo configuraste tu middleware, será 401 o 403
        expect([401, 403]).toContain(response.statusCode);
    });

    /* 
    =========================================================
    EJEMPLOS PARA EL FUTURO (Descomenta cuando estés listo)
    =========================================================

    // Prueba de Login (POST)
    test('POST /api/auth/login con credenciales inválidas debería dar 400/401', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({
                email: "correo_que_no_existe@test.com",
                password: "contraseña_falsa"
            });
        
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    // Prueba de creación de movimiento (Protegida con Token)
    test('POST /api/movimientos sin token debería fallar', async () => {
        const response = await request(app)
            .post('/api/movimientos')
            .send({
                tipo_flujo: "Salida",
                subtipo_modulo: "Gasto",
                datos: { monto: 1000, descripcion: "Prueba" }
            });
        
        expect(response.statusCode).toBe(401); // O 403
    });

    */
});