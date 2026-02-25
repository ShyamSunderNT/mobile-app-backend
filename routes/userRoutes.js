import express from "express";
import { completeProfile, getAllUsers, getProfile, savePushToken, sendEmailOtp, updateProfile, uploadMiddleware,  verifyEmailOtp } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";


const router = express.Router();
router.post("/send-otp" , sendEmailOtp)
router.post("/verify-otp" , verifyEmailOtp)
router.get("/fetch-profile", protect,getProfile)
router.put("/profile-update", protect, uploadMiddleware, updateProfile)
router.post("/complete-profile" , protect, uploadMiddleware, completeProfile)
router.get("/all-user" , protect,getAllUsers)
router.post("/save-token" , protect,savePushToken)
export default router;