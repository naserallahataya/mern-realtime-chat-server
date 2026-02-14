import mongoose from "mongoose";

const UserSchema =new mongoose.Schema({
    username: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    avatarUrl: { type: String, default: null },
    statusText: { type: String, default: '' },
    lastSeen: { type: Date, default: Date.now }
},{ timestamps: true });

const User = mongoose.model("User", UserSchema);

export default User;