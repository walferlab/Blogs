import { app } from '../server.js';

export default function handler(request, response) {
  return app(request, response);
}
