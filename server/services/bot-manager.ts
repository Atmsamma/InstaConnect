
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs/promises";

interface BotStatus {
  isRunning: boolean;
  logs: string[];
  error?: string;
}

class BotManager {
  private botProcess: ChildProcess | null = null;
  private logs: string[] = [];
  private maxLogs = 1000;

  constructor() {
    this.logs = [];
  }

  private addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    this.logs.push(logEntry);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  async startBot(): Promise<{ success: boolean; message: string }> {
    if (this.botProcess && !this.botProcess.killed) {
      return { success: false, message: "Bot is already running" };
    }

    try {
      // Check if session file exists
      const sessionFiles = await this.findSessionFiles();
      if (sessionFiles.length === 0) {
        return { 
          success: false, 
          message: "No Instagram session found. Please log in first." 
        };
      }

      const scriptPath = path.join(process.cwd(), "server", "bot-script.py");
      
      this.botProcess = spawn("python", [scriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: process.cwd()
      });

      this.addLog("🚀 Starting Instagram bot...");

      this.botProcess.stdout?.on("data", (data) => {
        const output = data.toString().trim();
        if (output) {
          this.addLog(output);
        }
      });

      this.botProcess.stderr?.on("data", (data) => {
        const output = data.toString().trim();
        if (output) {
          this.addLog(output);
        }
      });

      this.botProcess.on("exit", (code, signal) => {
        if (signal === "SIGTERM") {
          this.addLog("🛑 Bot stopped by user");
        } else if (code !== 0) {
          this.addLog(`❌ Bot exited with code ${code}`);
        } else {
          this.addLog("✅ Bot stopped normally");
        }
        this.botProcess = null;
      });

      this.botProcess.on("error", (error) => {
        this.addLog(`❌ Bot process error: ${error.message}`);
        this.botProcess = null;
      });

      return { success: true, message: "Bot started successfully" };
    } catch (error: any) {
      this.addLog(`❌ Failed to start bot: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  async stopBot(): Promise<{ success: boolean; message: string }> {
    if (!this.botProcess || this.botProcess.killed) {
      return { success: false, message: "Bot is not running" };
    }

    try {
      this.botProcess.kill("SIGTERM");
      
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force kill if still running
      if (this.botProcess && !this.botProcess.killed) {
        this.botProcess.kill("SIGKILL");
      }

      this.addLog("🛑 Bot stop requested");
      return { success: true, message: "Bot stopped successfully" };
    } catch (error: any) {
      this.addLog(`❌ Error stopping bot: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  getStatus(): BotStatus {
    return {
      isRunning: this.botProcess !== null && !this.botProcess.killed,
      logs: [...this.logs],
    };
  }

  private async findSessionFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(".");
      return files.filter(file => file.endsWith("_session.json"));
    } catch (error) {
      return [];
    }
  }
}

export const botManager = new BotManager();
