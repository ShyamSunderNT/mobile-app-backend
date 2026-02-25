import express from "express";
import { getChatHistory, getConversations, markAsSeen, sendMessage } from "../controllers/chatControllers.js";
import { protect } from "../middleware/authMiddleware.js";
import { addMember, createGroup, getGroupDetails, getGroupMessages, getUserGroups, leaveGroup, makeAdmin, removeMember, sendGroupMessage, updateGroupPic } from "../controllers/groupController.js";
import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({ storage });


const router = express.Router();

router.post("/send" , sendMessage)
router.get("/history/:user1/:user2" , getChatHistory)
router.put("/seen" , markAsSeen)
router.get("/conversations" , protect , getConversations )
router.get("/group/id/:groupId" , protect,getGroupMessages)
router.post("/group/send", protect,sendGroupMessage)
router.post("/group/create", protect ,upload.single("groupPic"), createGroup)
router.get("/group/my-groups", protect, getUserGroups)
router.get("/group/details/:groupId", protect, getGroupDetails);
router.put("/group/update-pic/:groupId", protect, upload.single("groupPic"),updateGroupPic)
router.put("/:groupId/add-member" , protect , addMember)
router.put("/:groupId/remove-member" , protect , removeMember)
router.put("/:groupId/leave" , protect , leaveGroup)
router.put("/make-admin/:groupId" ,protect,makeAdmin)
export default router;