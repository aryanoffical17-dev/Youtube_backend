import mongoose from 'mongoose';

import { DB_NAME } from '../constant.js';

const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error("MONGO_URI is required");
    }
    const connection = await mongoose.connect(mongoUri, { dbName: DB_NAME });
    console.log(`MongoDB connected: ${connection.connection.host}/${DB_NAME}`);
};

export default connectDB;