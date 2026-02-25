import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      unique: true,
      sparse: true,
    },

    phone: {
  type: String,
  unique: true,
  sparse: true  // 🔥 VERY IMPORTANT
},
    isVerified: {
      type: Boolean,
      default: true,
    },

    profilePic: {
      type: String,
      default: "",
    },
    isOnline: {
      type: Boolean,
      default: false,
    },

    socketId: {
      type: String,
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    about: {
      type: String,
      default: "Hey there! I'm using ChatApp 🚀",
    },

    lastSeen: {
      type: Date,
    },
    pushToken: {
      type: String,
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
