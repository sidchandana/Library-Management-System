const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const databaseName = process.env.MONGODB_DATABASE || 'Library_Management';

function explain(err) {
  const msg = String(err && err.message ? err.message : err);

  if (/bad auth|authentication failed|auth failed/i.test(msg)) {
    return (
      'MongoDB rejected the username or password in MONGODB_URI. ' +
      'Check the database user in Atlas (Database Access). If the password contains characters such as ' +
      '@ : / ? # % they must be URL-encoded inside the connection string.'
    );
  }
  if (/ENOTFOUND|querySrv|EAI_AGAIN/i.test(msg)) {
    return (
      'Could not resolve the MongoDB host in MONGODB_URI. Check the cluster address and your internet connection. ' +
      `(${msg})`
    );
  }
  if (/ServerSelection|timed out|ECONNREFUSED|whitelist|not allowed/i.test(msg)) {
    return (
      'Could not reach MongoDB. On Atlas, open Network Access and allow your current IP address ' +
      '(or 0.0.0.0/0 for a hosted server). If you use a local MongoDB, make sure mongod is running. ' +
      `(${msg})`
    );
  }
  return msg;
}

async function connectToDatabase() {
  if (uri.includes('<db_password>') || uri.includes('<password>')) {
    throw new Error('MONGODB_URI still contains the <db_password> placeholder. Put your real database password in it.');
  }
  try {
    await mongoose.connect(uri, { dbName: databaseName, serverSelectionTimeoutMS: 10000 });
  } catch (err) {
    throw new Error(explain(err));
  }
  return mongoose.connection;
}

module.exports = { connectToDatabase, databaseName };
