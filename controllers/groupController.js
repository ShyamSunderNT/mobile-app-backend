import Group from "../models/Group.js";
import Message from "../models/Message.js";
import cloudinary from "../Database/cloudinary.js";

export const createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;

    if (!name || !members) {
      return res.status(400).json({
        success: false,
        message: "Group name and members required",
      });
    }

    // 🔥 IMPORTANT FIX
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
          },
        );
        stream.end(req.file.buffer);
      });

      groupPicUrl = result.secure_url;
    }

    const uniqueMembers = [...new Set([...parsedMembers, req.user.id])];

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

export const getGroupMessages = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    // 1️⃣ Check group exists
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // 2️⃣ Check user is member
    if (!group.members.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group",
      });
    }

    // 3️⃣ Pagination (optional but recommended)
    const page = parseInt(req.query.page) || 1;
    const limit = 30;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ groupId })
      .populate("senderId", "name profilePic")
      .sort({ createdAt: -1 }) // latest first
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      page,
      messages: messages.reverse(),
      memberCount: group.members.length, // return oldest → newest
    });
  } catch (error) {
    next(error);
  }
};

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

    let newMessage = await Message.create({
      senderId,
      groupId,
      message,
      messageType,
      mediaUrl,
    });

    // 🔥 Populate sender
    newMessage = await newMessage.populate("senderId", "name profilePic");

    res.status(201).json({
      success: true,
      data: newMessage,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserGroups = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const groups = await Group.find({
      members: userId,
    }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      groups,
    });
  } catch (error) {
    next(error);
  }
};

export const getGroupDetails = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId).populate(
      "members",
      "name profilePic phone",
    );

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

export const updateGroupPic = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name } = req.body;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // 🔥 Only admin can edit
    if (!group.admins.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can edit group",
      });
    }

    // ✅ Update Name
    if (name) {
      group.name = name;
    }

    // ✅ Update Group Pic
    if (req.file) {
      // delete old pic
      if (group.groupPic) {
        const publicId = group.groupPic.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`chat-app-groups/${publicId}`);
      }

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "chat-app-groups" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
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
      group: updatedGroup,
    });

    res.status(200).json({
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

export const addMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userIdToAdd } = req.body;
    const currentUserId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) return res.status(404).json({ message: "Group not found" });

    // 🔐 Check if current user is admin
    if (!group.admins.includes(currentUserId))
      return res.status(403).json({ message: "Only admin can add members" });

    // Already member check
    if (group.members.includes(userIdToAdd))
      return res.status(400).json({ message: "User already in group" });

    group.members.push(userIdToAdd);
    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate("members", "name profilePic phone")
      .populate("admins");

    res.json({
      success: true,
      message: "Member added successfully",
      group: updatedGroup,
    });

    res.json({ message: "Member added successfully", group });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const removeMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userIdToRemove } = req.body;
    const currentUserId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) return res.status(404).json({ message: "Group not found" });

    if (!group.admins.includes(currentUserId))
      return res.status(403).json({ message: "Only admin can remove members" });

    group.members = group.members.filter(
      (member) => member.toString() !== userIdToRemove,
    );

    group.admins = group.admins.filter(
      (admin) => admin.toString() !== userIdToRemove,
    ); // If removed user is admin also remove admin role

    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate("members", "name profilePic phone")
      .populate("admins");

    res.json({
      success: true,
      message: "Member removed successfully",
      group: updatedGroup,
    });

    res.json({ message: "Member removed successfully", group });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) return res.status(404).json({ message: "Group not found" });

    group.members = group.members.filter(
      (member) => member.toString() !== currentUserId,
    );

    group.admins = group.admins.filter(
      (admin) => admin.toString() !== currentUserId,
    );

    // ⚠️ Important: If no admin left → auto assign new admin
    if (group.admins.length === 0 && group.members.length > 0) {
      group.admins.push(group.members[0]);
    }

    await group.save();

    res.json({ message: "Left group successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const makeAdmin = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userIdToMakeAdmin } = req.body;
    const currentUserId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // 🔐 Only existing admin can make another admin
    if (!group.admins.includes(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can assign admin role",
      });
    }

    // ✅ Check user is member
    if (!group.members.includes(userIdToMakeAdmin)) {
      return res.status(400).json({
        success: false,
        message: "User is not a group member",
      });
    }

    // ❌ Prevent duplicate admin
    if (group.admins.includes(userIdToMakeAdmin)) {
      return res.status(400).json({
        success: false,
        message: "User is already an admin",
      });
    }

    // 🔥 Add new admin
    group.admins.push(userIdToMakeAdmin);

    await group.save();

    // 🔥 Return populated updated group
    const updatedGroup = await Group.findById(groupId)
      .populate("members", "name profilePic phone")
      .populate("admins", "name profilePic phone");

    res.status(200).json({
      success: true,
      message: "Admin role assigned successfully",
      group: updatedGroup,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
