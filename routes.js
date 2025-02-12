import express from 'express';
import connection from './database.js'; 
const router = express.Router();

router.get('/test', (req, res) => {
  res.json({ 
    message: 'Conexión exitosa', 
    status: 'OK' 
  });
});


router.post('/events', (req, res) => {
    const { name, type, date, startTime, endTime, color } = req.body;
    const query = 'INSERT INTO calendar_events (name, type, date, start_time, end_time, color) VALUES (?, ?, ?, ?, ?, ?)';
    
    connection.query(query, [name, type, date, startTime, endTime, color], (err, result) => {
      if (err) {
        console.error('Error en la consulta SQL:', err);
        return res.status(500).json({ error: 'Error al guardar el evento' });
      }
      res.status(201).json({ id: result.insertId }); 
    });
  });

  router.put('/events/:id', (req, res) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
  
    const { startTime, endTime } = req.body;
    connection.query(
      'SELECT * FROM calendar_events WHERE id = ?',
      [id],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Error en la consulta' });
        if (result.length === 0) {
          return res.status(404).json({ error: 'Evento no encontrado' });
        }
  
        // Actualizar si existe
        connection.query(
          'UPDATE calendar_events SET start_time = ?, end_time = ? WHERE id = ?',
          [startTime, endTime, id],
          (errUpdate) => {
            if (errUpdate) {
              return res.status(500).json({ error: 'Error al actualizar el evento' });
            }
            res.status(200).json({ message: 'Evento actualizado' });
          }
        );
      }
    );
  });
  
  router.put('/events/modal/:id', (req, res) => {
    const id = parseInt(req.params.id);
  
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
  
    const { name, type, date, startTime, endTime, color } = req.body;
  
    const query = `
      UPDATE calendar_events 
      SET name = ?, type = ?, date = ?, start_time = ?, end_time = ?, color = ? 
      WHERE id = ?;
    `;
  
    connection.query(
      query,
      [name, type, date, startTime, endTime, color, id],
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
  

export default  router;