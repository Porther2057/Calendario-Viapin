// server.js (o tu archivo de servidor principal)
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { testConnection } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const distFolder = path.join(__dirname, 'dist/calendario-viapin/browser');
app.use(express.static(distFolder));

// Middleware para parsear JSON y datos de formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta para crear un evento
app.post('/api/events', async (req, res) => {
  const { id, name, type, date, startTime, endTime, color } = req.body;

  // Validar que todos los campos sean correctos
  if (!id || !name || !type || !date || !startTime || !endTime || !color) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  // Consulta SQL para insertar un nuevo evento
  const query = `
    INSERT INTO calendar_events (id, name, type, date, start_time, end_time, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)`;

  try {
    // Ejecutar la consulta con los datos del cuerpo de la solicitud
    await pool.query(query, [id, name, type, date, startTime, endTime, color]);
    res.status(201).json({ message: 'Evento creado correctamente' });
  } catch (error) {
    console.error('Error al guardar el evento:', error);
    res.status(500).json({ error: 'Error al guardar el evento' });
  }
});

// Endpoint para actualizar un evento
app.put('/api/events/:id', async (req, res) => {
  const eventId = req.params.id;
  const { startTime, endTime } = req.body;

  // Validación básica
  if (!startTime || !endTime) {
    return res.status(400).json({ error: 'Faltan campos requeridos para actualizar el evento' });
  }

  const query = 'UPDATE calendar_events SET start_time = ?, end_time = ? WHERE id = ?';

  try {
    const [result] = await pool.query(query, [startTime, endTime, eventId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    res.json({ message: 'Evento actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar evento:', error);
    res.status(500).json({ error: 'Error al actualizar evento' });
  }
});




// Endpoint para actualizar los porcentajes de actividades
app.put('/api/activity-percentages/:fecha', async (req, res) => {
  try {
    const { fecha } = req.params;
    const { estrategica, administrativa, operativa, personal } = req.body;
    
    // Consulta para verificar si existe un registro para esa fecha
    const checkQuery = 'SELECT id FROM activity_stats WHERE fecha = ?';
    const [existingRecord] = await pool.query(checkQuery, [fecha]);
    
    let query;
    let values;
    
    if (existingRecord.length > 0) {
      // Si existe, actualizar
      query = `
        UPDATE activity_stats
        SET estrategica = ?, 
            administrativa = ?, 
            operativa = ?, 
            personal = ?
        WHERE fecha = ?
      `;
      values = [estrategica, administrativa, operativa, personal, fecha];
    } else {
      // Si no existe, insertar
      query = `
        INSERT INTO activity_stats 
        (fecha, estrategica, administrativa, operativa, personal)
        VALUES (?, ?, ?, ?, ?)
      `;
      values = [fecha, estrategica, administrativa, operativa, personal];
    }
    
    await pool.query(query, values);
    
    res.status(200).json({ 
      message: existingRecord.length > 0 
        ? 'Porcentajes actualizados exitosamente' 
        : 'Porcentajes guardados exitosamente' 
    });
  } catch (error) {
    console.error('Error al actualizar los porcentajes:', error);
    res.status(500).json({ error: 'Error al actualizar los porcentajes' });
  }
});


// Endpoint para obtener el histórico de porcentajes
app.get('/api/activity-percentages', async (req, res) => {
  try {
    const query = `
      SELECT * FROM activity_stats
      ORDER BY fecha DESC 
      LIMIT 30
    `;

    const [rows] = await pool.query(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error al obtener los porcentajes:', error);
    res.status(500).json({ error: 'Error al obtener los porcentajes' });
  }
});


// Ruta principal 
app.get('*', (req, res) => {
  res.sendFile(path.join(distFolder, 'index.html'));
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});

// Probar conexión a la base de datos al iniciar
testConnection();
