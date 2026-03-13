import { Router } from "express";
import multer from "multer";
import { authenticateUser } from "./middleware";
import { uploadFileToStorage } from "../upload-service";
import { db, storage } from "../storage";
import sharp from "sharp";
import path from "path";

const router = Router();

// Use memory storage to buffer the file before passing it to uploadFileToStorage
// which abstracts away Cloudinary (production) vs local filesystem (dev)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

router.post("/", authenticateUser, upload.single("file"), async (req, res) => {
  const startTime = Date.now();
  
  if (!req.file) {
    console.error("❌ [UPLOAD] No file received in request");
    return res.status(400).json({ message: "No file uploaded" });
  }

  const uploadType = (req.body.uploadType || req.query.uploadType || "general").toLowerCase();
  const { userId, caption, categoryId } = req.body;
  
  console.log(`🚀 [UPLOAD] Processing upload. Type: ${uploadType}, Name: ${req.file.originalname}, Size: ${req.file.size} bytes`);

  if (!uploadType) {
    return res.status(400).json({ message: "Upload type is required" });
  }

  try {
    // Determine target user if this is a profile image upload
    const targetUserId = userId || req.user!.id;
    
    // Authorization check for profile uploads
    if (uploadType === "profile" && targetUserId !== req.user!.id && req.user!.roleId > 2) {
      return res.status(403).json({ message: "Not authorized to update this profile" });
    }

    const isImage = req.file.mimetype.startsWith('image/');
    let fileToUpload = req.file;

    // Handle image compression if it's an image
    if (isImage) {
      try {
        const imageBuffer = req.file.buffer;
        if (!imageBuffer) {
          throw new Error("No file buffer available for compression");
        }

        console.log(`🖼️ [UPLOAD] Compressing image: ${req.file.originalname}`);

        // Professional compression using sharp
        const compressedBuffer = await sharp(imageBuffer)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .ensureAlpha()
          .webp({ quality: 80, lossless: false, nearLossless: false, force: true })
          .toBuffer();

        console.log(`✅ [UPLOAD] Compression success. Original: ${req.file.size}, Compressed: ${compressedBuffer.length}`);

        fileToUpload = {
          ...req.file,
          buffer: compressedBuffer,
          originalname: `${path.parse(req.file.originalname).name}.webp`,
          mimetype: 'image/webp',
          size: compressedBuffer.length
        } as Express.Multer.File;
      } catch (sharpError) {
        console.error("⚠️ [UPLOAD] Image compression failed, falling back to original:", sharpError);
        fileToUpload = req.file;
      }
    }

    // Upload to target storage (Cloudinary or local)
    const result = await uploadFileToStorage(fileToUpload, {
      uploadType,
      userId: targetUserId,
      category: categoryId,
    });

    if (!result.success || !result.url) {
      return res.status(500).json({ message: result.error || "Upload failed" });
    }

    // Store references in the DB based on the upload type
    if (uploadType === "profile") {
      await storage.updateUser(targetUserId, {
        profileImageUrl: result.url,
      });
      
      console.log(`✅ [UPLOAD] Profile image URL saved to user record: ${targetUserId}`);
    } else if (uploadType === "gallery") {
      // Create gallery image
      await storage.uploadGalleryImage({
        imageUrl: result.url,
        caption: caption || "",
        categoryId: categoryId ? parseInt(categoryId) : undefined,
        uploadedBy: req.user!.id,
      });
      console.log(`✅ [UPLOAD] Gallery image record created`);
    } else if (uploadType === "homepage" || uploadType === "logo" || uploadType === "favicon") {
      console.log(`✅ [UPLOAD] ${uploadType} uploaded to storage. URL: ${result.url}`);
      // Usually updated via system settings, but we log it here
    }
    // Note: Other types like 'study-resource', 'assignment', 'system-settings' 
    // might be handled elsewhere or just return the URL for the client to use.


    res.json({
      success: true,
      url: result.url,
      message: "File uploaded successfully",
    });
  } catch (error: any) {
    console.error("Upload route error:", error);
    res.status(500).json({ message: error.message || "Internal server error during upload" });
  }
});

router.delete("/profile", authenticateUser, async (req, res) => {
  try {
    const userId = req.body.userId || req.user!.id;
    
    // Authorization check
    if (userId !== req.user!.id && req.user!.roleId > 2) {
      return res.status(403).json({ message: "Not authorized to update this profile" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.profileImageUrl) {
      const { deleteFileFromStorage } = await import("../upload-service");
      await deleteFileFromStorage(user.profileImageUrl);
      
      await storage.updateUser(userId, {
        profileImageUrl: null,
      });
      
      console.log(`✅ [UPLOAD] Profile image removed for user: ${userId}`);
    }

    res.json({
      success: true,
      message: "Profile image removed successfully",
    });
  } catch (error: any) {
    console.error("Profile image deletion error:", error);
    res.status(500).json({ message: error.message || "Internal server error during deletion" });
  }
});

export default router;
