import mongoose from "mongoose";

const connectDB=async()=>{
    try{
        mongoose.connect(process.env.MONGO_URL)
        console.log("Database connected successfully ^_^");
    }catch(err){
        console.log("Database connection error -_- :", err.message);
        device.exit(1);
    }
}
export default connectDB;