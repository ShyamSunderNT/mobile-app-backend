import Group from "../models/Group.js";
import Message from "../models/Message.js";
import cloudinary from "../Database/cloudinary.js";

/* =========================
   CREATE GROUP
========================= */
export const createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;

    if (!name || !members) {
      return res.status(400).json({
        success: false,
        message: "Group name and members required",
      });
    }

    const parsedMembers =
      typeof members === "string" ? JSON.parse(members) : members;

    let groupPicUrl = "";

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "chat-app-groups" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      groupPicUrl = result.secure_url;
    }

    const uniqueMembers = [
      ...new Set([...parsedMembers, req.user.id]),
    ];

    const group = await Group.create({
      name,
      members: uniqueMembers,
      admins: [req.user.id],
      groupPic: groupPicUrl,
    });

    res.status(201).json({
      success: true,
      group,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================
   GET GROUP MESSAGES
========================= */
export const getGroupMessages = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    if (!group.members.some(m => m.toString() === userId)) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 30;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ groupId })
      .populate("senderId", "name profilePic")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      page,
      messages: messages.reverse(),
      memberCount: group.members.length,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================
   SEND GROUP MESSAGE
========================= */
export const sendGroupMessage = async (req, res, next) => {
  try {
    const { groupId, message, messageType, mediaUrl } = req.body;
    const senderId = req.user.id;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: "Group ID required",
      });
    }

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    if (!group.members.some(m => m.toString() === senderId)) {
      return res.status(403).json({
        success: false,
        message: "Not a group member",
      });
    }

    let newMessage = await Message.create({
      senderId,
      groupId,
      message,
      messageType,
      mediaUrl,
    });

    newMessage = await newMessage.populate(
      "senderId",
      "name profilePic"
    );

    await Group.findByIdAndUpdate(groupId, {
      updatedAt: new Date(),
    });

    const io = req.app.get("io");
    io.to(groupId.toString()).emit(
      "receive_group_message",
      newMessage
    );

    res.status(201).json({
      success: true,
      data: newMessage,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================
   GET USER GROUPS
========================= */
export const getUserGroups = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const groups = await Group.find({
      members: userId,
    })
      .populate("members", "name profilePic")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      groups,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================
   GET GROUP DETAILS
========================= */
export const getGroupDetails = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId)
      .populate("members", "name profilePic phone")
      .populate("admins", "name profilePic phone");

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    res.status(200).json({
      success: true,
      group,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================
   ADD MEMBER
========================= */
export const addMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userIdToAdd } = req.body;
    const currentUserId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group)
      return res.status(404).json({ success: false, message: "Group not found" });

    if (!group.admins.some(a => a.toString() === currentUserId))
      return res.status(403).json({ success: false, message: "Only admin can add members" });

    if (group.members.some(m => m.toString() === userIdToAdd))
      return res.status(400).json({ success: false, message: "User already in group" });

    group.members.push(userIdToAdd);
    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate("members", "name profilePic phone")
      .populate("admins", "name profilePic phone");

    res.json({
      success: true,
      message: "Member added successfully",
      group: updatedGroup,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================
   REMOVE MEMBER
========================= */
export const removeMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userIdToRemove } = req.body;
    const currentUserId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group)
      return res.status(404).json({ success: false, message: "Group not found" });

    if (!group.admins.some(a => a.toString() === currentUserId))
      return res.status(403).json({ success: false, message: "Only admin can remove members" });

    group.members = group.members.filter(
      m => m.toString() !== userIdToRemove
    );

    group.admins = group.admins.filter(
      a => a.toString() !== userIdToRemove
    );

    await group.save();

    res.json({
      success: true,
      message: "Member removed successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================
   LEAVE GROUP
========================= */
export const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group)
      return res.status(404).json({ success: false, message: "Group not found" });

    group.members = group.members.filter(
      m => m.toString() !== currentUserId
    );

    group.admins = group.admins.filter(
      a => a.toString() !== currentUserId
    );

    if (group.admins.length === 0 && group.members.length > 0) {
      group.admins.push(group.members[0]);
    }

    await group.save();

    res.json({
      success: true,
      message: "Left group successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================
   MAKE ADMIN
========================= */
export const makeAdmin = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userIdToMakeAdmin } = req.body;
    const currentUserId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group)
      return res.status(404).json({ success: false, message: "Group not found" });

    if (!group.admins.some(a => a.toString() === currentUserId))
      return res.status(403).json({ success: false, message: "Only admin can assign admin role" });

    if (!group.members.some(m => m.toString() === userIdToMakeAdmin))
      return res.status(400).json({ success: false, message: "User is not a member" });

    if (group.admins.some(a => a.toString() === userIdToMakeAdmin))
      return res.status(400).json({ success: false, message: "User already admin" });

    group.admins.push(userIdToMakeAdmin);
    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate("members", "name profilePic phone")
      .populate("admins", "name profilePic phone");

    res.json({
      success: true,
      message: "Admin role assigned successfully",
      group: updatedGroup,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


/* =========================
   UPDATE GROUP PIC / NAME
========================= */
export const updateGroupPic = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name } = req.body;
    const currentUserId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // 🔐 Only admin can update
    if (!group.admins.some(a => a.toString() === currentUserId)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can edit group",
      });
    }

    // ✅ Update name if provided
    if (name) {
      group.name = name;
    }

    // ✅ Update group image if provided
    if (req.file) {
      // delete old image if exists
      if (group.groupPic) {
        try {
          const publicId = group.groupPic
            .split("/")
            .pop()
            .split(".")[0];

          await cloudinary.uploader.destroy(
            `chat-app-groups/${publicId}`
          );
        } catch (err) {
          console.log("Cloudinary delete error:", err.message);
        }
      }

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "chat-app-groups" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      group.groupPic = result.secure_url;
    }

    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate("members", "name profilePic phone")
      .populate("admins", "name profilePic phone");

    res.status(200).json({
      success: true,
      message: "Group updated successfully",
      group: updatedGroup,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};