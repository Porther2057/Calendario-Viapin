import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import router from './routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());

app.use('/api', router); 

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});