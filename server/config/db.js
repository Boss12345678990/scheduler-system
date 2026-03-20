const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod = null;

const connectDB = async () => {
  try {
    let uri = process.env.MONGO_URI;

    // Try connecting to the configured URI first
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      console.log(`MongoDB Connected: ${mongoose.connection.host}`);
      return;
    } catch (err) {
      console.log('Local MongoDB not available, starting in-memory database...');
      await mongoose.disconnect().catch(() => {});
    }

    // Fallback to in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log(`MongoDB In-Memory Connected: ${uri}`);
    console.log('⚠️  Data will be lost when server restarts. Use a real MongoDB for persistent data.');
  } catch (error) {
    console.error(`MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
