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

  app.get("/api/bot/trigger-messages", async (req, res) => {
    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      
      const triggerMessagesPath = path.join(process.cwd(), "output", "trigger_messages.json");
      
      try {
        const data = await fs.readFile(triggerMessagesPath, "utf-8");
        const triggerMessages = JSON.parse(data);
        
        // Convert to array and sort by timestamp
        const messagesArray = Object.values(triggerMessages).sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        res.json({
          success: true,
          messages: messagesArray,
          count: messagesArray.length
        });
      } catch (fileError) {
        // File doesn't exist yet
        res.json({
          success: true,
          messages: [],
          count: 0
        });
      }
    } catch (error: any) {
      console.error("Trigger messages error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get trigger messages"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
