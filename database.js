// database.js
import mysql from 'mysql2';

const connection = mysql.createConnection({
  host: 'localhost',  
  user: 'root',       
  password: '', 
  database: 'calendario-viapin' 
});

connection.connect((err) => {
  if (err) {
    console.error('Error de conexión: ' + err.stack);
    return;
  }
  console.log('Conectado a la base de datos');
});

export default connection;
