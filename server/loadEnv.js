const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });
// dotenv.config({ path: path.resolve(__dirname, 'config.env') });
// dotenv.config({ path: path.resolve(__dirname, '../atlas-credentials.env') });

if (!process.env.SECRET_KEY) {
  throw new Error(
    'SECRET_KEY is not set. Copy server/.env.example to server/.env and set SECRET_KEY to a long random string.'
  );
}
