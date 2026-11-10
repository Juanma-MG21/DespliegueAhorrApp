jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../Backend/src/db/connection', () => ({ query: jest.fn(), connect: jest.fn() }));

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const pool = require('../../Backend/src/db/connection');
const categorias = require('../../Backend/src/routes/categoriasRoutes');

const app = express();
app.use(express.json());
app.use('/api/categorias', categorias);

const claveJwt = 'clave-exclusiva-de-jest';
const token = jwt.sign({ id: 7, roles: ['usuario'] }, claveJwt);
const autorizacion = { Authorization: 'Bearer ' + token };

beforeEach(() => {
  jest.replaceProperty(process, 'env', { ...process.env, JWT_SECRET: claveJwt });
  pool.query.mockReset();
  pool.connect.mockReset();
});

describe('RF-15 · Categorías financieras', () => {
  test('requiere autenticación para consultar categorías', async () => {
    await request(app).get('/api/categorias').expect(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('rechaza el nombre vacío antes de iniciar una transacción', async () => {
    await request(app).post('/api/categorias').set(autorizacion).send({ nombre: ' ' }).expect(400);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test.each(['patch', 'delete'])('protege una categoría ajena o del sistema al ejecutar %s', async (metodo) => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const ruta = '/api/categorias/12' + (metodo === 'patch' ? '/deshabilitar' : '');
    await request(app)[metodo](ruta).set(autorizacion).expect(403);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringMatching(/id_usuario.*es_global.*sistema/is), ['12', 7]
    );
  });

  test('rechaza eliminar una categoría activa', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ activa: true }] });
    await request(app).delete('/api/categorias/12').set(autorizacion).expect(409);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});
