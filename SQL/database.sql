-- ========================================================================
-- BLOQUE DE TABLAS PARA LA GESTIÓN DE USUARIOS Y ROLES (usuarios, rol, usuarios_roles)
-- ========================================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100),
    reset_code VARCHAR(255) DEFAULT NULL,
    reset_code_expires TIMESTAMP DEFAULT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_eliminacion_programada TIMESTAMP NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rol (
    id_rol SERIAL PRIMARY KEY,
    cargo VARCHAR(50) NOT NULL
);

-- Inserción de los roles iniciales
INSERT INTO rol (cargo) VALUES ('user'), ('admin'), ('superuser');


CREATE TABLE IF NOT EXISTS usuarios_roles (
    id_usuario INT NOT NULL,
    id_rol INT NOT NULL,
    PRIMARY KEY (id_usuario, id_rol),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_rol) REFERENCES rol(id_rol) ON DELETE CASCADE ON UPDATE CASCADE
);


-- ========================================================================
-- BLOQUE DE TABLAS PARA LA GESTIÓN DE CATEGORÍAS
-- (categorias)
-- ========================================================================
CREATE TABLE IF NOT EXISTS categorias (
    id_categoria SERIAL PRIMARY KEY,
    id_usuario INT,
    nombre VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255),
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    sistema BOOLEAN NOT NULL DEFAULT FALSE,
    es_global BOOLEAN NOT NULL DEFAULT FALSE,

    FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE
);

-- ÍNDICE ÚNICO PARA CATEGORÍAS GLOBALES

CREATE UNIQUE INDEX IF NOT EXISTS
idx_categorias_globales_nombre
ON categorias (nombre)
WHERE es_global = TRUE;

-- CATEGORÍAS PREDETERMINADAS POR EL SISTEMA
INSERT INTO categorias (
    id_usuario,
    nombre,
    descripcion,
    activa,
    sistema,
    es_global
)
SELECT
    NULL,
    'Alimentación',
    'Gastos en comida y bebida',
    TRUE,
    TRUE,
    TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM categorias
    WHERE nombre = 'Alimentación'
      AND es_global = TRUE
);

INSERT INTO categorias (
    id_usuario,
    nombre,
    descripcion,
    activa,
    sistema,
    es_global
)
SELECT
    NULL,
    'Transporte',
    'Movilidad y combustible',
    TRUE,
    TRUE,
    TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM categorias
    WHERE nombre = 'Transporte'
      AND es_global = TRUE
);

INSERT INTO categorias (
    id_usuario,
    nombre,
    descripcion,
    activa,
    sistema,
    es_global
)
SELECT
    NULL,
    'Salud',
    'Médicos, medicamentos y bienestar',
    TRUE,
    TRUE,
    TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM categorias
    WHERE nombre = 'Salud'
      AND es_global = TRUE
);

INSERT INTO categorias (
    id_usuario,
    nombre,
    descripcion,
    activa,
    sistema,
    es_global
)
SELECT
    NULL,
    'Educación',
    'Colegiaturas, libros y cursos',
    TRUE,
    TRUE,
    TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM categorias
    WHERE nombre = 'Educación'
      AND es_global = TRUE
);

INSERT INTO categorias (
    id_usuario,
    nombre,
    descripcion,
    activa,
    sistema,
    es_global
)
SELECT
    NULL,
    'Entretenimiento',
    'Ocio, streaming y salidas',
    TRUE,
    TRUE,
    TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM categorias
    WHERE nombre = 'Entretenimiento'
      AND es_global = TRUE
);

INSERT INTO categorias (
    id_usuario,
    nombre,
    descripcion,
    activa,
    sistema,
    es_global
)
SELECT
    NULL,
    'Servicios',
    'Agua, luz, internet y gas',
    TRUE,
    TRUE,
    TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM categorias
    WHERE nombre = 'Servicios'
      AND es_global = TRUE
);

INSERT INTO categorias (
    id_usuario,
    nombre,
    descripcion,
    activa,
    sistema,
    es_global
)
SELECT
    NULL,
    'Vivienda',
    'Alquiler, hipoteca y mantenimiento',
    TRUE,
    TRUE,
    TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM categorias
    WHERE nombre = 'Vivienda'
      AND es_global = TRUE
);

INSERT INTO categorias (
    id_usuario,
    nombre,
    descripcion,
    activa,
    sistema,
    es_global
)
SELECT
    NULL,
    'Salario',
    'Pago mensual o quincenal por parte de alguna entidad',
    TRUE,
    TRUE,
    TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM categorias
    WHERE nombre = 'Salario'
      AND es_global = TRUE
);

INSERT INTO categorias (
    id_usuario,
    nombre,
    descripcion,
    activa,
    sistema,
    es_global
)
SELECT
    NULL,
    'Negocio',
    'Ingresos provenientes de un negocio propio',
    TRUE,
    TRUE,
    TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM categorias
    WHERE nombre = 'Negocio'
      AND es_global = TRUE
);



-- ========================================================================
-- BLOQUE DE TABLAS PARA LA GESTIÓN DE DEPENDIENTES
-- (dependientes)
-- ========================================================================

CREATE TABLE IF NOT EXISTS dependientes (
    id_dependientes SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    relacion VARCHAR(100),
    ocupacion VARCHAR(150),
    fecha_nacimiento DATE,
    peso_economico SMALLINT NOT NULL DEFAULT 1,

    CONSTRAINT chk_peso_rango
        CHECK (peso_economico BETWEEN 1 AND 5),

    FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE
);

-- ÍNDICE DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_dependientes_usuario
ON dependientes (id_usuario);



-- ========================================================================
-- BLOQUE DE TABLAS PARA LA GESTIÓN DE MOVIMIENTOS
-- (movimientos)
-- ========================================================================

-- CREACIÓN DE TIPOS ENUM EN POSTGRESQL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'tipo_flujo_enum'
    ) THEN
        CREATE TYPE tipo_flujo_enum AS ENUM (
            'Entrada',
            'Salida'
        );
    END IF;
END
$$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'subtipo_modulo_enum'
    ) THEN
        CREATE TYPE subtipo_modulo_enum AS ENUM (
            'Ahorro',
            'Ingreso',
            'Gasto',
            'Deuda',
            'Imprevisto'
        );
    END IF;
END
$$;

-- TABLA MOVIMIENTOS
CREATE TABLE IF NOT EXISTS movimientos (
    id_movimiento SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    tipo_flujo tipo_flujo_enum NOT NULL,
    subtipo_modulo subtipo_modulo_enum NOT NULL,

    CONSTRAINT chk_tipo_subtipo_movimiento
        CHECK (
            (
                tipo_flujo = 'Entrada'
                AND subtipo_modulo IN ('Ahorro', 'Ingreso')
            )
            OR
            (
                tipo_flujo = 'Salida'
                AND subtipo_modulo IN ('Gasto', 'Deuda', 'Imprevisto')
            )
        ),

    FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE
);

-- ÍNDICE DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_movimientos_usuario
ON movimientos (id_usuario);



-- ========================================================================
-- BLOQUE DE TABLAS PARA MOVIMIENTOS DE TIPO ENTRADA
-- (entrada, ahorros, abonos_ahorro, ingresos)
-- ========================================================================

-- 1. TABLA ENTRADA
CREATE TABLE IF NOT EXISTS entrada (

    id_entrada SERIAL PRIMARY KEY,

    id_movimiento INT NOT NULL UNIQUE,

    FOREIGN KEY (id_movimiento)
        REFERENCES movimientos(id_movimiento)
        ON DELETE CASCADE
);

-- VALIDACIÓN: solo movimientos con tipo_flujo = 'Entrada' pueden tener fila en 'entrada'
CREATE OR REPLACE FUNCTION validar_flujo_entrada()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM movimientos m
        WHERE m.id_movimiento = NEW.id_movimiento
          AND m.tipo_flujo = 'Entrada'
    ) THEN
        RAISE EXCEPTION 'El movimiento % no tiene tipo_flujo = Entrada', NEW.id_movimiento;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_flujo_entrada ON entrada;
CREATE TRIGGER trg_validar_flujo_entrada
BEFORE INSERT OR UPDATE ON entrada
FOR EACH ROW EXECUTE FUNCTION validar_flujo_entrada();


-- 2. TABLA AHORROS
CREATE TABLE IF NOT EXISTS ahorros (
    id_ahorros SERIAL PRIMARY KEY,
    id_entrada INT NOT NULL,
    id_categoria INT,
    monto DECIMAL(15,2) NOT NULL,
    monto_acumulado DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    descripcion VARCHAR(255),
    meta VARCHAR(100),
    fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE, 
    fecha_meta DATE,

    CONSTRAINT chk_monto
    CHECK (monto > 0),

    CONSTRAINT chk_acumulado
    CHECK (
        monto_acumulado >= 0
        AND monto_acumulado <= monto
    ),

    CONSTRAINT chk_fechas
        CHECK (
            fecha_meta IS NULL
            OR fecha_meta >= fecha_registro
        ),

    FOREIGN KEY (id_entrada)
        REFERENCES entrada(id_entrada)
        ON DELETE CASCADE,

    FOREIGN KEY (id_categoria)
        REFERENCES categorias(id_categoria)
        ON DELETE SET NULL
);

-- VALIDACIÓN: la entrada referenciada debe pertenecer a un movimiento subtipo 'Ahorro'
CREATE OR REPLACE FUNCTION validar_subtipo_ahorros()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM entrada e
        JOIN movimientos m ON m.id_movimiento = e.id_movimiento
        WHERE e.id_entrada = NEW.id_entrada
          AND m.subtipo_modulo = 'Ahorro'
    ) THEN
        RAISE EXCEPTION 'La entrada % no corresponde a un movimiento subtipo Ahorro', NEW.id_entrada;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_subtipo_ahorros ON ahorros;
CREATE TRIGGER trg_validar_subtipo_ahorros
BEFORE INSERT OR UPDATE ON ahorros
FOR EACH ROW EXECUTE FUNCTION validar_subtipo_ahorros();

-- 3. TABLA ABONOS_AHORRO
CREATE TABLE IF NOT EXISTS abonos_ahorro (
    id_abono SERIAL PRIMARY KEY,
    id_ahorros INT NOT NULL,
    monto DECIMAL(15,2) NOT NULL,
    fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,

    CONSTRAINT chk_abono_monto
        CHECK (monto > 0),

        

    FOREIGN KEY (id_ahorros)
        REFERENCES ahorros(id_ahorros)
        ON DELETE CASCADE
);

-- 4. TABLA INGRESOS
CREATE TABLE IF NOT EXISTS ingresos (
    id_ingresos SERIAL PRIMARY KEY,
    id_entrada INT NOT NULL,
    id_categoria INT,
    monto DECIMAL(15,2) NOT NULL,
    descripcion VARCHAR(255),
    fuente VARCHAR(150),
    fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,

    CONSTRAINT chk_monto_ingreso
        CHECK (monto > 0),

    FOREIGN KEY (id_entrada)
        REFERENCES entrada(id_entrada)
        ON DELETE CASCADE,

    FOREIGN KEY (id_categoria)
        REFERENCES categorias(id_categoria)
        ON DELETE SET NULL
);

-- VALIDACIÓN: la entrada referenciada debe pertenecer a un movimiento subtipo 'Ingreso'
CREATE OR REPLACE FUNCTION validar_subtipo_ingresos()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM entrada e
        JOIN movimientos m ON m.id_movimiento = e.id_movimiento
        WHERE e.id_entrada = NEW.id_entrada
          AND m.subtipo_modulo = 'Ingreso'
    ) THEN
        RAISE EXCEPTION 'La entrada % no corresponde a un movimiento subtipo Ingreso', NEW.id_entrada;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_subtipo_ingresos ON ingresos;
CREATE TRIGGER trg_validar_subtipo_ingresos
BEFORE INSERT OR UPDATE ON ingresos
FOR EACH ROW EXECUTE FUNCTION validar_subtipo_ingresos();

-- ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_ahorros_entrada
ON ahorros (id_entrada);

CREATE INDEX IF NOT EXISTS idx_ahorros_categoria
ON ahorros (id_categoria);

CREATE INDEX IF NOT EXISTS idx_abonos_ahorro
ON abonos_ahorro (id_ahorros);

CREATE INDEX IF NOT EXISTS idx_ingresos_entrada
ON ingresos (id_entrada);

CREATE INDEX IF NOT EXISTS idx_ingresos_categoria
ON ingresos (id_categoria);



-- ========================================================================
-- BLOQUE DE TABLAS PARA MOVIMIENTOS DE TIPO SALIDA
-- (salida, gastos, deudas, imprevistos)
-- ========================================================================

-- 1. CREACIÓN DEL TIPO ENUM PARA DEUDAS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'estado_deuda_enum'
    ) THEN
        CREATE TYPE estado_deuda_enum AS ENUM (
            'pendiente',
            'pagada'
        );
    END IF;
END
$$;


-- 2. TABLA SALIDA
CREATE TABLE IF NOT EXISTS salida (
    id_salida SERIAL PRIMARY KEY,
    id_movimiento INT NOT NULL UNIQUE,

    FOREIGN KEY (id_movimiento)
        REFERENCES movimientos(id_movimiento)
        ON DELETE CASCADE
);

-- VALIDACIÓN: solo movimientos con tipo_flujo = 'Salida' pueden tener fila en 'salida'
CREATE OR REPLACE FUNCTION validar_flujo_salida()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM movimientos m
        WHERE m.id_movimiento = NEW.id_movimiento
          AND m.tipo_flujo = 'Salida'
    ) THEN
        RAISE EXCEPTION 'El movimiento % no tiene tipo_flujo = Salida', NEW.id_movimiento;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_flujo_salida ON salida;
CREATE TRIGGER trg_validar_flujo_salida
BEFORE INSERT OR UPDATE ON salida
FOR EACH ROW EXECUTE FUNCTION validar_flujo_salida();

-- 3. TABLA GASTOS
CREATE TABLE IF NOT EXISTS gastos (
    id_gastos SERIAL PRIMARY KEY,
    id_salida INT NOT NULL,
    id_categoria INT,
    id_dependientes INT,
    monto DECIMAL(15,2) NOT NULL,
    descripcion VARCHAR(255),
    fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,

    CONSTRAINT chk_monto_gasto
        CHECK (monto > 0),

    FOREIGN KEY (id_salida)
        REFERENCES salida(id_salida)
        ON DELETE CASCADE,

    FOREIGN KEY (id_categoria)
        REFERENCES categorias(id_categoria)
        ON DELETE SET NULL,

    FOREIGN KEY (id_dependientes)
        REFERENCES dependientes(id_dependientes)
        ON DELETE SET NULL
);

-- VALIDACIÓN: la salida referenciada debe pertenecer a un movimiento subtipo 'Gasto'
CREATE OR REPLACE FUNCTION validar_subtipo_gastos()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM salida s
        JOIN movimientos m ON m.id_movimiento = s.id_movimiento
        WHERE s.id_salida = NEW.id_salida
          AND m.subtipo_modulo = 'Gasto'
    ) THEN
        RAISE EXCEPTION 'La salida % no corresponde a un movimiento subtipo Gasto', NEW.id_salida;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_subtipo_gastos ON gastos;
CREATE TRIGGER trg_validar_subtipo_gastos
BEFORE INSERT OR UPDATE ON gastos
FOR EACH ROW EXECUTE FUNCTION validar_subtipo_gastos();

-- 4. TABLA IMPREVISTOS
CREATE TABLE IF NOT EXISTS imprevistos (
    id_imprevistos SERIAL PRIMARY KEY,
    id_salida INT NOT NULL,
    id_categoria INT,
    id_dependientes INT,
    monto DECIMAL(15,2) NOT NULL,
    causa VARCHAR(255),
    fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,

    CONSTRAINT chk_monto_imprevisto
        CHECK (monto > 0),

    FOREIGN KEY (id_salida)
        REFERENCES salida(id_salida)
        ON DELETE CASCADE,

    FOREIGN KEY (id_categoria)
        REFERENCES categorias(id_categoria)
        ON DELETE SET NULL,

    FOREIGN KEY (id_dependientes)
        REFERENCES dependientes(id_dependientes)
        ON DELETE SET NULL
);

-- VALIDACIÓN: la salida referenciada debe pertenecer a un movimiento subtipo 'Imprevisto'
CREATE OR REPLACE FUNCTION validar_subtipo_imprevistos()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM salida s
        JOIN movimientos m ON m.id_movimiento = s.id_movimiento
        WHERE s.id_salida = NEW.id_salida
          AND m.subtipo_modulo = 'Imprevisto'
    ) THEN
        RAISE EXCEPTION 'La salida % no corresponde a un movimiento subtipo Imprevisto', NEW.id_salida;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_subtipo_imprevistos ON imprevistos;
CREATE TRIGGER trg_validar_subtipo_imprevistos
BEFORE INSERT OR UPDATE ON imprevistos
FOR EACH ROW EXECUTE FUNCTION validar_subtipo_imprevistos();

-- 5. TABLA DEUDAS
CREATE TABLE IF NOT EXISTS deudas (
    id_deudas SERIAL PRIMARY KEY,
    id_salida INT NOT NULL,
    id_categoria INT,
    monto DECIMAL(15,2) NOT NULL,
    fuente VARCHAR(150) NOT NULL,
    descripcion VARCHAR(255),
    cuotas_total INT,
    cuotas_pagadas INT NOT NULL DEFAULT 0,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado estado_deuda_enum NOT NULL DEFAULT 'pendiente',

    CONSTRAINT chk_monto_deuda
        CHECK (monto >= 0),

    CONSTRAINT chk_cuotas_total
        CHECK (
            cuotas_total IS NULL
            OR cuotas_total > 0
        ),

    CONSTRAINT chk_cuotas_pagadas
        CHECK (cuotas_pagadas >= 0),

    CONSTRAINT chk_fechas_deuda
        CHECK (
            fecha_fin IS NULL
            OR fecha_fin >= fecha_inicio
        ),

    CONSTRAINT chk_logica_cuotas
        CHECK (
            cuotas_total IS NULL
            OR cuotas_pagadas <= cuotas_total
        ),

    FOREIGN KEY (id_salida)
        REFERENCES salida(id_salida)
        ON DELETE CASCADE,

    FOREIGN KEY (id_categoria)
        REFERENCES categorias(id_categoria)
        ON DELETE SET NULL
);

-- VALIDACIÓN: la salida referenciada debe pertenecer a un movimiento subtipo 'Deuda'
CREATE OR REPLACE FUNCTION validar_subtipo_deudas()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM salida s
        JOIN movimientos m ON m.id_movimiento = s.id_movimiento
        WHERE s.id_salida = NEW.id_salida
          AND m.subtipo_modulo = 'Deuda'
    ) THEN
        RAISE EXCEPTION 'La salida % no corresponde a un movimiento subtipo Deuda', NEW.id_salida;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_subtipo_deudas ON deudas;
CREATE TRIGGER trg_validar_subtipo_deudas
BEFORE INSERT OR UPDATE ON deudas
FOR EACH ROW EXECUTE FUNCTION validar_subtipo_deudas();

-- ========================================================================
-- 1. TABLA ABONOS DE DEUDA
-- Registra cada pago realizado sobre una deuda.
-- ========================================================================

CREATE TABLE IF NOT EXISTS abonos_deuda (
    id_abono_deuda SERIAL PRIMARY KEY,
    id_deudas INT NOT NULL,
    cuotas INT NOT NULL DEFAULT 1,
    monto DECIMAL(15,2) NOT NULL,
    fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,
    descripcion VARCHAR(255),

    CONSTRAINT chk_abono_deuda_cuotas
        CHECK (cuotas > 0),

    CONSTRAINT chk_abono_deuda_monto
        CHECK (monto > 0),

    FOREIGN KEY (id_deudas)
        REFERENCES deudas(id_deudas)
        ON DELETE CASCADE
);



-- ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_gastos_salida
ON gastos (id_salida);

CREATE INDEX IF NOT EXISTS idx_gastos_categoria
ON gastos (id_categoria);

CREATE INDEX IF NOT EXISTS idx_gastos_dependiente
ON gastos (id_dependientes);

CREATE INDEX IF NOT EXISTS idx_imprevistos_salida
ON imprevistos (id_salida);

CREATE INDEX IF NOT EXISTS idx_imprevistos_categoria
ON imprevistos (id_categoria);

CREATE INDEX IF NOT EXISTS idx_imprevistos_dependiente
ON imprevistos (id_dependientes);

CREATE INDEX IF NOT EXISTS idx_deudas_salida
ON deudas (id_salida);

CREATE INDEX IF NOT EXISTS idx_deudas_categoria
ON deudas (id_categoria);


-- ========================================================================
-- BLOQUE DE TABLAS PARA LA GESTIÓN DE PRESUPUESTOS FINANCIEROS
-- (presupuestos, periodos_presupuesto)
-- ========================================================================

-- 1. CREACIÓN DEL TIPO ENUM PARA PERIODOS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'estado_periodo_enum'
    ) THEN
        CREATE TYPE estado_periodo_enum AS ENUM (
            'abierto',
            'cerrado'
        );
    END IF;
END
$$;

-- 2. TABLA PRESUPUESTOS
CREATE TABLE IF NOT EXISTS presupuestos (
    id_presupuesto SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    nombre VARCHAR(80) NOT NULL DEFAULT 'Mi presupuesto',
    descripcion VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT FALSE,
    dia_corte SMALLINT NOT NULL DEFAULT 1,
    porcentaje_gastos DECIMAL(5,2) NOT NULL DEFAULT 40.00,
    porcentaje_deudas DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    porcentaje_imprevistos DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    porcentaje_ahorros DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    porcentaje_emergencia DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,


    CONSTRAINT chk_dia_corte
        CHECK (dia_corte BETWEEN 1 AND 31),


    CONSTRAINT chk_porcentaje_gastos
        CHECK (porcentaje_gastos BETWEEN 0 AND 100),

    CONSTRAINT chk_porcentaje_deudas
        CHECK (porcentaje_deudas BETWEEN 0 AND 100),

    CONSTRAINT chk_porcentaje_imprevistos
        CHECK (porcentaje_imprevistos BETWEEN 0 AND 100),

    CONSTRAINT chk_porcentaje_ahorros
        CHECK (porcentaje_ahorros BETWEEN 0 AND 100),

    CONSTRAINT chk_porcentaje_emergencia
        CHECK (porcentaje_emergencia BETWEEN 0 AND 100),

    
    CONSTRAINT chk_porcentajes_total
        CHECK (
            porcentaje_gastos
            + porcentaje_deudas
            + porcentaje_imprevistos
            + porcentaje_ahorros
            + porcentaje_emergencia = 100
        ),          


    FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE
);

-- ÍNDICE ÚNICO: solo un presupuesto activo por usuario a la vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_presupuesto_activo_unico
ON presupuestos (id_usuario)
WHERE activo = TRUE;

-- 3. FUNCIÓN Y TRIGGER PARA ACTUALIZAR fecha_actualizacion
CREATE OR REPLACE FUNCTION actualizar_fecha_presupuesto()

RETURNS TRIGGER AS $$

BEGIN

    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;

    RETURN NEW;

END;

$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_fecha_presupuesto
ON presupuestos;

CREATE TRIGGER trg_actualizar_fecha_presupuesto

BEFORE UPDATE ON presupuestos

FOR EACH ROW

EXECUTE FUNCTION actualizar_fecha_presupuesto();

-- 4. TABLA PERIODOS_PRESUPUESTO
CREATE TABLE IF NOT EXISTS periodos_presupuesto (
    id_periodo SERIAL PRIMARY KEY,
    id_presupuesto INT NOT NULL,
    id_usuario INT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    ingreso_estimado DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    ingreso_real DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    saldo_anterior DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    estado estado_periodo_enum NOT NULL DEFAULT 'abierto',
    monto_gastos DECIMAL(15,2) NOT NULL,
    monto_deudas DECIMAL(15,2) NOT NULL,
    monto_imprevistos DECIMAL(15,2) NOT NULL,
    monto_ahorros DECIMAL(15,2) NOT NULL,
    monto_emergencia DECIMAL(15,2) NOT NULL,


    CONSTRAINT chk_periodo_fechas
        CHECK (fecha_fin > fecha_inicio),

    CONSTRAINT chk_ingreso_estimado_pos
        CHECK (ingreso_estimado >= 0),

    CONSTRAINT chk_ingreso_real_pos
        CHECK (ingreso_real >= 0),

    CONSTRAINT chk_saldo_anterior_pos
        CHECK (saldo_anterior >= 0),

    CONSTRAINT chk_gastos_pos
        CHECK (monto_gastos >= 0),

    CONSTRAINT chk_deudas_pos
        CHECK (monto_deudas >= 0),

    CONSTRAINT chk_imprevistos_pos
        CHECK (monto_imprevistos >= 0),

    CONSTRAINT chk_ahorros_pos
        CHECK (monto_ahorros >= 0),

    CONSTRAINT chk_emergencia_pos
        CHECK (monto_emergencia >= 0),
      

    FOREIGN KEY (id_presupuesto)
        REFERENCES presupuestos(id_presupuesto)
        ON DELETE CASCADE,

    FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE
);

-- ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_periodos_presupuesto
ON periodos_presupuesto (id_presupuesto);

CREATE INDEX IF NOT EXISTS idx_periodos_usuario
ON periodos_presupuesto (id_usuario);

CREATE INDEX IF NOT EXISTS idx_periodos_fechas
ON periodos_presupuesto (fecha_inicio, fecha_fin);


-- ========================================================================
-- BLOQUE DE TABLAS PARA LA GESTIÓN DE HISTORIAL DE ACCIONES
-- ========================================================================
CREATE TABLE IF NOT EXISTS historial (
    id_historial SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    accion VARCHAR(200) NOT NULL,
    detalles TEXT,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE
);

-- ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_historial_usuario
ON historial (id_usuario);

CREATE INDEX IF NOT EXISTS idx_historial_fecha
ON historial (fecha);


-- ========================================================================
-- BLOQUE DE TABLAS PARA LA GESTIÓN DE NOTIFICACIONES
-- (notificaciones, preferencias_notificacion)
-- ========================================================================

-- 1. CREACIÓN DEL TIPO ENUM PARA NOTIFICACIONES
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'tipo_notificacion_enum'
    ) THEN
        CREATE TYPE tipo_notificacion_enum AS ENUM (
            'sistema',
            'recordatorio',
            'sugerencia',
            'alerta_presupuesto'
        );
    END IF;
END
$$;

-- 2. TABLA NOTIFICACIONES
CREATE TABLE IF NOT EXISTS notificaciones (
    id_notificacion SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    tipo tipo_notificacion_enum NOT NULL,
    entidad_tipo VARCHAR(50),
    entidad_id INT,
    mensaje TEXT NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    archivada BOOLEAN NOT NULL DEFAULT FALSE,

    FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE
);

-- 3. TABLA PREFERENCIAS_NOTIFICACION
CREATE TABLE IF NOT EXISTS preferencias_notificacion (
    id_usuario INT NOT NULL,
    tipo tipo_notificacion_enum NOT NULL,
    activa BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id_usuario, tipo),

    FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE
);

-- 4. ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_notif_usuario_leida
ON notificaciones (id_usuario, leida, archivada);

CREATE INDEX IF NOT EXISTS idx_notif_entidad
ON notificaciones (entidad_tipo, entidad_id, tipo);

-- ===============================================================
-- TABLA DE FONDOS DE EMERGENCIA
-- ===============================================================

CREATE TABLE IF NOT EXISTS fondos_emergencia (
    id_fondo SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL UNIQUE,
    meta DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    fecha_creacion DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_meta_fondo_emergencia
        CHECK (meta >= 0),

    FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE
);
-- ========================================================================
-- 3. ENUM PARA LOS MOVIMIENTOS DEL FONDO DE EMERGENCIA
-- ========================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'tipo_movimiento_fondo_enum'
    ) THEN
        CREATE TYPE tipo_movimiento_fondo_enum AS ENUM (
            'aporte',
            'retiro'
        );
    END IF;
END
$$;


-- ========================================================================
-- 4. TABLA MOVIMIENTOS DEL FONDO DE EMERGENCIA
-- Registra aportes y retiros del fondo.
-- ========================================================================

CREATE TABLE IF NOT EXISTS movimientos_fondo_emergencia (
    id_movimiento_fondo SERIAL PRIMARY KEY,
    id_fondo INT NOT NULL,
    tipo tipo_movimiento_fondo_enum NOT NULL,
    monto DECIMAL(15,2) NOT NULL,
    fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,
    descripcion VARCHAR(255),

    CONSTRAINT chk_monto_movimiento_fondo
        CHECK (monto > 0),

    FOREIGN KEY (id_fondo)
        REFERENCES fondos_emergencia(id_fondo)
        ON DELETE CASCADE
);


-- ========================================================================
-- ÍNDICES DE RENDIMIENTO
-- ========================================================================

CREATE INDEX IF NOT EXISTS idx_abonos_deuda_deuda
ON abonos_deuda (id_deudas);

CREATE INDEX IF NOT EXISTS idx_abonos_deuda_fecha
ON abonos_deuda (fecha_registro);

CREATE INDEX IF NOT EXISTS idx_fondos_emergencia_usuario
ON fondos_emergencia (id_usuario);

CREATE INDEX IF NOT EXISTS idx_movimientos_fondo_fondo
ON movimientos_fondo_emergencia (id_fondo);

CREATE INDEX IF NOT EXISTS idx_movimientos_fondo_fecha
ON movimientos_fondo_emergencia (fecha_registro);

CREATE INDEX IF NOT EXISTS idx_movimientos_fondo_tipo
ON movimientos_fondo_emergencia (tipo);


-- ========================================================================
-- SEGURIDAD: ROW LEVEL SECURITY (RLS)
-- ========================================================================
-- Se activa RLS en todas las tablas expuestas por Supabase (requisito de
-- seguridad de Supabase/PostgREST). NO se crean políticas permisivas para
-- 'anon' ni 'authenticated': como el sistema usa autenticación propia
-- (tabla usuarios + password_hash, no auth.users de Supabase), el backend
-- debe conectarse con la service_role key, que por defecto IGNORA RLS.
-- Esto bloquea cualquier acceso directo desde el frontend con la anon key.
-- Si en el futuro el frontend necesita leer/escribir directo vía la API
-- de Supabase, habría que crear políticas específicas basadas en un
-- esquema de autenticación compatible (ej. auth.uid()).

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE rol ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrada ENABLE ROW LEVEL SECURITY;
ALTER TABLE ahorros ENABLE ROW LEVEL SECURITY;
ALTER TABLE abonos_ahorro ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE salida ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE imprevistos ENABLE ROW LEVEL SECURITY;
ALTER TABLE deudas ENABLE ROW LEVEL SECURITY;
ALTER TABLE abonos_deuda ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodos_presupuesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferencias_notificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE fondos_emergencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_fondo_emergencia ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PUSH_TOKENS (tokens FCM del móvil)
-- Usada por POST /api/push-tokens y NotificacionesService.
-- Faltaba en este esquema: sin ella el endpoint respondía 500
-- ("relation push_tokens does not exist"). Es idempotente: se
-- puede ejecutar también sobre una BD ya existente.
-- ============================================================
CREATE TABLE IF NOT EXISTS push_tokens (
    id_push_token SERIAL PRIMARY KEY,
    id_usuario    INT NOT NULL,
    fcm_token     TEXT NOT NULL UNIQUE,
    plataforma    VARCHAR(20) NOT NULL,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_usuario ON push_tokens(id_usuario);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
