require('dotenv').config();
const mongoose = require('mongoose');

console.log('Testing MongoDB connection...');
console.log('MONGO_URI:', process.env.MONGO_URI);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Failed:', err.message);
    console.log('\nIf using MongoDB Atlas, make sure your connection string looks like:');
    console.log('mongodb+srv://username:password@cluster.xxxxx.mongodb.net/database');
    console.log('\nIf using local MongoDB, make sure MongoDB is running on port 27017');
    process.exit(1);
  });
