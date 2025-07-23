import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { instagramLogin } from "./services/instagram-auth";

export async function registerRoutes(app: Express): Promise<Server> {
  
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password, reuseSession, twoFactorCode, challengeMethod, challengeCode } = req.body;

      if (!username || !password) {
        return res.status(400).json({ 
          success: false, 
          message: "Username and password are required" 
        });
      }

      const result = await instagramLogin({
        username,
        password,
        reuseSession,
        twoFactorCode,
        challengeMethod,
        challengeCode
      });

      res.json(result);
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Internal server error" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
