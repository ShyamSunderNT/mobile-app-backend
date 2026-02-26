import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import fetch from "node-fetch";

export const sendMessage = async (req, res, next) => {
  try {
    const { receiverId, groupId, message, messageType, mediaUrl } = req.body;

    const senderId = req.user.id;

    if (!senderId) {
      return res.status(400).json({
        success: false,
        message: "Sender required",
      });
    }

    /* ===============================
       🔥 GROUP MESSAGE
    =============================== */
    if (groupId) {
      const newMessage = await Message.create({
        senderId,
        groupId,
        message,
        messageType,
        mediaUrl,
      });

      return res.status(201).json({
        success: true,
        data: newMessage,
      });
    }

    /* ===============================
       🔥 PRIVATE MESSAGE
    =============================== */

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver required for private chat",
      });
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      message,
      messageType,
      mediaUrl,
    });

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] }, 
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
      });
    }

    conversation.lastMessage = message;
    conversation.lastMessageType = messageType;
    conversation.lastMessageAt = new Date();

    const currentUnread = conversation.unreadCount.get(receiverId) || 0;

    conversation.unreadCount.set(receiverId, currentUnread + 1);
    conversation.unreadCount.set(senderId, 0);

    await conversation.save();

    const io = req.app.get("io");
    io.to(receiverId.toString()).emit("conversation_updated");
    io.to(senderId.toString()).emit("conversation_updated");
    const receiver = await User.findById(receiverId);
    const sender = await User.findById(senderId);

    if (receiver?.pushToken) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: receiver.pushToken,
          sound: "default",
          title: sender?.name || "New Message",
          body: message || "You have a new message",
          data: { senderId },
        }),
      });
    }

    res.status(201).json({
      success: true,
      data: newMessage,
    });
  } catch (error) {
    next(error);
  }
};

/* =============================
   GET CHAT HISTORY
============================= */
export const getChatHistory = async (req, res, next) => {
  try {
    const { user1, user2 } = req.params;

    const messages = await Message.find({
      $or: [
        { senderId: user1, receiverId: user2 },
        { senderId: user2, receiverId: user1 },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("senderId", "name profilePic")
      .populate("receiverId", "name profilePic");

    res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    next(error);
  }
};

/* =============================
   MARK AS SEEN
============================= */
export const markAsSeen = async (req, res, next) => {
  try {
    const { senderId, receiverId } = req.body;

    // 1️⃣ Update messages as seen
    await Message.updateMany(
      {
        senderId,
        receiverId,
        seen: false,
      },
      { seen: true },
    );

    // 2️⃣ Reset unread count in Conversation
    await Conversation.updateOne(
      {
        participants: { $all: [senderId, receiverId] },
      },
      {
        $set: {
          [`unreadCount.${senderId}`]: 0,
        },
      },
    );

    res.status(200).json({
      success: true,
      message: "Messages marked as seen & unread reset",
    });
  } catch (error) {
    next(error);
  }
};

/* =============================
   GET ALL CONVERSATIONS
============================= */
export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    console.log("JWT User ID:", req.user.id);

    const conversations = await Conversation.find({
      participants: { $in: [userId] },
      // 🔥 IMPORTANT FIX
    })

      .populate("participants", "name profilePic isOnline")
      .sort({ lastMessageAt: -1 });
    console.log("All conversations:", conversations);

    res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    next(error);
  }
};
