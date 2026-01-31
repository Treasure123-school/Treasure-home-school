import { Router } from "express";
import { storage } from "../../storage";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authenticateUser, SECRET_KEY, JWT_EXPIRES_IN } from "../middleware";

const router = Router();

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1)
});

router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = loginSchema.parse(req.body);
    const user = await storage.getUserByUsernameOrEmail(identifier);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id, roleId: user.roleId },
      SECRET_KEY,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({ user, token });
  } catch (error) {
    res.status(400).json({ message: "Login failed" });
  }
});

export default router;
