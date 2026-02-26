
import Otp from "../models/otp.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import multer from "multer";
import cloudinary from "../Database/cloudinary.js";
import { Resend } from "resend";


const storage = multer.memoryStorage();
const upload = multer({ storage });
export const uploadMiddleware = upload.single("profilePic");


const resend = new Resend(process.env.RESEND_API_KEY);

// 🔐 Generate JWT
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET_KEY,
    { expiresIn: "7d" }
  );
};



// =============================
// 📩 SEND EMAIL OTP
// =============================
export const sendEmailOtp = async (req, res) => {
  try {
    const {  email } = req.body;

   if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.deleteMany({ email });

    await Otp.create({
      email,
      otp,
      expiresAt,
    });

      // ✅ Send Email using Resend
    await resend.emails.send({
      from: "Chat App <onboarding@resend.dev>", // change later to your verified domain
      to: email,
      subject: "Your OTP Code",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Your OTP Code</h2>
          <p>Your OTP is:</p>
          <h1 style="color:#14b8a6;">${otp}</h1>
          <p>This OTP expires in 5 minutes.</p>
        </div>
      `,
    });

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });

  } catch (error) {
    console.log("Send OTP Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// =============================
// 🔐 VERIFY EMAIL OTP
// =============================
export const verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const record = await Otp.findOne({ email, otp });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (record.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    let user = await User.findOne({ email });

    let isNewUser = false;

     if (!user) {
      user = await User.create({
        email,
        isVerified: true,
      });

      isNewUser = true;
    }
    const token = generateToken(user._id);

    await Otp.deleteMany({ email });

    res.status(200).json({
      success: true,
      token,
      user,
      isNewUser,
    });

  } catch (error) {
    console.log("Verify OTP Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const completeProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and phone required",
      });
    }

    let profilePicUrl = "";

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "chat-app-profiles" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        stream.end(req.file.buffer);
      });

      profilePicUrl = result.secure_url;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name,
        phone,
        profilePic: profilePicUrl,
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      user,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      user,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, phone, about } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update text fields
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (about) user.about = about;

    // If new image uploaded
    if (req.file) {

      // Delete old image from cloudinary (optional advanced)
      if (user.profilePic) {
        const publicId = user.profilePic.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`chat-app-profiles/${publicId}`);
      }

      // Upload new image
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "chat-app-profiles" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      user.profilePic = result.secure_url;
    }

    await user.save();

    res.status(200).json({
      success: true,
      user,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user.id },
    }).select("name profilePic isOnline");

    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const savePushToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Push token required",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.pushToken = token;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Push token saved",
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};