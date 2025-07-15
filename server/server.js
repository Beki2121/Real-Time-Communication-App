import 'dotenv/config';
import http from 'http';
import app from './app.js';
import setupSockets from './sockets/index.js';

const server = http.createServer(app);
setupSockets(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 