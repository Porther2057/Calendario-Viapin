// database.js
import mysql from 'mysql2/promise';

// Crear pool de conexiones
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'calendario-viapin',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Función para probar la conexión
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Conexión a base de datos completa');
    connection.release();
  } catch (error) {
    console.error('Error al conectar a base de datos:', error);
  }
}

// Función para ejecutar consultas de manera genérica
export async function executeQuery(query, params = []) {
  try {
    const [results] = await pool.execute(query, params);
    return results;
  } catch (error) {
    console.error('Error en la consulta:', error);
    throw error;
  }
}

export default pool;