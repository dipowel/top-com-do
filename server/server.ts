import 'dotenv/config';
import { app } from './app';

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`[top.com.do] API escuchando en http://localhost:${port}`);
});
