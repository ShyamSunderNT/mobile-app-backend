import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import userRouter from "./routes/userRoutes.js";
import connectDB from "./Database/Database.js";
import chatRoute from "./routes/chatRouter.js";


import http from "http";
import { Server } from "socket.io";
import User from "./models/User.js";


dotenv.config();

const app = express();
const server = http.createServer(app);
 console.log("URI:", process.env.MONGODB_URL);



app.use(
  cors({
    origin: "*",
    credentials: true,
  }),
);

connectDB();

app.use(express.json()); // important for req.body
app.use(express.urlencoded({ extended: true }));
app.use("/api", userRouter);
app.use("/api/chat", chatRoute);

app.get("/", (req, res) => {
  res.send("Welcome to the api");
});

const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  socket.on("join_room", async (userId) => {
    try {
      socket.join(userId);

      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        socketId: socket.id,
      });

    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("send_message", async (data) => {
  const { senderId, receiverId } = data;

  const receiver = await User.findById(receiverId);

  if (receiver?.isOnline) {
    await Message.updateOne(
      {
        senderId,
        receiverId,
        seen: false,
      },
      { delivered: true }
    );

    io.to(senderId).emit("message_delivered", {
      receiverId,
    });
  }

  io.to(receiverId).emit("receive_message", data);
});

  // 🔥 Typing Start
socket.on("typing", ({ senderId, receiverId }) => {
  io.to(receiverId).emit("typing", { senderId });
});

// 🔥 Typing Stop
socket.on("stop_typing", ({ senderId, receiverId }) => {
  io.to(receiverId).emit("stop_typing", { senderId });
});

socket.on("join_group", (groupId) => {
  socket.join(groupId);
});

socket.on("send_group_message", async (data) => {
  const message = await Message.create({
    senderId: data.senderId,
    groupId: data.groupId,
    text: data.text,
  });

  io.to(data.groupId).emit("receive_group_message", message);
});

  socket.on("disconnect", async () => {
    const user = await User.findOne({ socketId: socket.id });

    if (user) {
      user.isOnline = false;
      user.lastSeen = new Date();
      user.socketId = "";
      await user.save();
    }
  });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  });
});



const PORT = process.env.PORT || 4001;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
