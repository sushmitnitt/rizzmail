const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    
    // Debug log to see what URI is actually being loaded
    console.log('Attempting to connect with MONGO_URI:', uri ? `${uri.substring(0, 15)}...` : 'UNDEFINED');

    if (!uri) {
      throw new Error('MONGO_URI is missing or undefined in environment variables.');
    }

    await mongoose.connect(uri);
    console.log('MongoDB Connected Successfully!');
  } catch (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;