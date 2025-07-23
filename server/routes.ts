import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { instagramLogin } from "./services/instagram-auth";
import { botManager } from "./services/bot-manager";

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

  // Bot control routes
  app.post("/api/bot/start", async (req, res) => {
    try {
      const result = await botManager.startBot();
      res.json(result);
    } catch (error: any) {
      console.error("Bot start error:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to start bot" 
      });
    }
  });

  app.post("/api/bot/stop", async (req, res) => {
    try {
      const result = await botManager.stopBot();
      res.json(result);
    } catch (error: any) {
      console.error("Bot stop error:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to stop bot" 
      });
    }
  });

  app.get("/api/bot/logs", async (req, res) => {
    try {
      const status = botManager.getStatus();
      res.json({ 
        success: true, 
        logs: status.logs,
        isRunning: status.isRunning
      });
    } catch (error: any) {
      console.error("Bot logs error:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to get logs" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
