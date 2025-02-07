import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import router from './routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Añade estas líneas antes de app.listen()
app.use('/api', router);  // Define la ruta base para todas las peticiones

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});