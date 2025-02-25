import express from 'express';
import connection from './database.js'; 
const router = express.Router();

router.get('/test', (req, res) => {
  res.json({ 
    message: 'Conexión exitosa', 
    status: 'OK' 
  });
});

// Función de utilidad para convertir tiempo de 12h a 24h
const convertTo24Hour = (timeStr) => {
  if (!timeStr) return null;
  
  const [time, period] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// Obtener eventos por usuario
router.get('/events/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const query = `
      SELECT * FROM calendar_events 
      WHERE userId = ?
      ORDER BY date, start_time
    `;

    const [events] = await connection.promise().query(query, [userId]);

    res.json(events);
  } catch (error) {
    console.error('Error al obtener eventos:', error);
    res.status(500).json({ message: 'Error al obtener eventos' });
  }
});

// crear
router.post('/events', (req, res) => {
  const { name, type, date, startTime, endTime, userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId es requerido' });
  }

  // Verificar si el usuario existe
  const userQuery = 'SELECT COUNT(*) AS userExists FROM usuarios WHERE usuario = ?';
  connection.query(userQuery, [userId], (err, result) => {
    if (err) {
      console.error('Error en la consulta SQL:', err);
      return res.status(500).json({ error: 'Error al verificar el usuario' });
    }

    if (result[0].userExists === 0) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }

    // Convertir las horas de 12h a 24h
    const start24 = convertTo24Hour(startTime);
    const end24 = convertTo24Hour(endTime);

    if (!start24 || !end24) {
      return res.status(400).json({ error: 'Formato de hora inválido' });
    }

    const query = 'INSERT INTO calendar_events (name, type, date, start_time, end_time,  userId) VALUES (?, ?, ?, ?, ?, ?)';
    
    connection.query(query, [name, type, date, start24, end24, userId], (err, result) => {
      if (err) {
        console.error('Error en la consulta SQL:', err);
        return res.status(500).json({ error: 'Error al guardar el evento' });
      }
      res.status(201).json({ id: result.insertId });
    });
  });
});

//actualizar
router.put('/events/modal/:id', (req, res) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const { name, type, date, startTime, endTime } = req.body;
  const start24 = convertTo24Hour(startTime);
  const end24 = convertTo24Hour(endTime);

  if (!start24 || !end24) {
    return res.status(400).json({ error: 'Formato de hora inválido' });
  }

  const query = `
    UPDATE calendar_events 
    SET name = ?, type = ?, date = ?, start_time = ?, end_time = ?
    WHERE id = ?;
  `;

  connection.query(
    query,
    [name, type, date, start24, end24,  id],
    (err, result) => {
      if (err) {
        console.error('Error al actualizar el evento desde el modal:', err);
        return res.status(500).json({ error: 'Error al actualizar el evento' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Evento no encontrado' });
      }

      res.status(200).json({ message: 'Evento actualizado correctamente' });
    }
  );
});

//Borrar Evento
router.delete('/events/:id', (req, res) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  connection.query(
    'DELETE FROM calendar_events WHERE id = ?',
    [id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Error al eliminar el evento' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Evento no encontrado' });
      }

      res.status(200).json({ message: 'Evento eliminado correctamente' });
    }
  );
});

router.get('/events', (req, res) => {
  const query = 'SELECT * FROM calendar_events';

  connection.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener los eventos' });
    }
    res.status(200).json(results);
  });
});
  
// Obtener todos los usuarios
router.get('/users', async (req, res) => {
  try {
    const query = 'SELECT * FROM usuarios'; 
    const [usuarios] = await connection.promise().query(query);
    res.json(usuarios);
  } catch (error) {
    console.error('Error al obtener los usuarios:', error);
    res.status(500).json({ message: 'Error al obtener los usuarios' });
  }
});

//Obtener rol
router.get('/users/:username/role', async (req, res) => {
  try {
    const { username } = req.params; 
    const query = 'SELECT perfil FROM usuarios WHERE usuario = ?'; // Busca por username
    const [rows] = await connection.promise().query(query, [username]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    return res.status(200).json({ role: rows[0].perfil }); 
  } catch (error) {
    console.error('Error al obtener rol de usuario:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Verificar Usuario
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const query = 'SELECT * FROM usuarios WHERE usuario = ?';
    const [rows] = await connection.promise().query(query, [userId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Devolver los detalles del usuario sin incluir información sensible como contraseñas
    const userDetails = {
      id: rows[0].id,
      usuario: rows[0].usuario,
      perfil: rows[0].perfil
      // Añadir otros campos necesarios, omitiendo contraseñas
    };
    
    return res.status(200).json(userDetails);
    
  } catch (error) {
    console.error('Error al obtener detalles del usuario:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

export default  router;