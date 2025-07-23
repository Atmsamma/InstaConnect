import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";

interface LoginParams {
  username: string;
  password: string;
  reuseSession?: boolean;
  twoFactorCode?: string;
  challengeMethod?: string;
  challengeCode?: string;
}

interface LoginResult {
  success: boolean;
  message?: string;
  requiresTwoFactor?: boolean;
  requiresChallenge?: boolean;
  challengeMethods?: Array<{ type: string; destination: string }>;
  sessionExists?: boolean;
  sessionFile?: string;
}

export async function instagramLogin(params: LoginParams): Promise<LoginResult> {
  const { username, password, reuseSession, twoFactorCode, challengeMethod, challengeCode } = params;
  
  const scriptPath = path.join(process.cwd(), "server", "instagram_login.py");
  const sessionFile = `${username}_session.json`;
  
  // Check if session file exists
  try {
    await fs.access(sessionFile);
    if (reuseSession === undefined) {
      return {
        success: false,
        sessionExists: true,
        sessionFile: sessionFile
      };
    }
  } catch (error) {
    // Session file doesn't exist, continue with login
  }

  return new Promise((resolve, reject) => {
    const args = [scriptPath, username, password];
    
    if (reuseSession !== undefined) {
      args.push(reuseSession ? "reuse" : "fresh");
    }
    
    if (twoFactorCode) {
      args.push("2fa", twoFactorCode);
    }
    
    if (challengeMethod && challengeCode) {
      args.push("challenge", challengeMethod, challengeCode);
    }

    const pythonProcess = spawn("python3", args, {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (error) {
          resolve({ success: true, message: "Login successful!" });
        }
      } else {
        // Parse error output for specific scenarios
        const errorOutput = stderr.toLowerCase();
        
        if (errorOutput.includes("two-factor") || errorOutput.includes("2fa")) {
          resolve({
            success: false,
            requiresTwoFactor: true,
            message: "Two-factor authentication required"
          });
        } else if (errorOutput.includes("challenge")) {
          // Mock challenge methods for demo - in real implementation, parse from Python script
          resolve({
            success: false,
            requiresChallenge: true,
            challengeMethods: [
              { type: "sms", destination: "+1 •••• •••• 1234" },
              { type: "email", destination: "u***@example.com" }
            ],
            message: "Security challenge required"
          });
        } else {
          resolve({
            success: false,
            message: stderr || "Login failed"
          });
        }
      }
    });

    pythonProcess.on("error", (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });

    // Handle 2FA input
    if (twoFactorCode) {
      pythonProcess.stdin.write(twoFactorCode + "\n");
    }

    // Handle challenge method selection
    if (challengeMethod) {
      pythonProcess.stdin.write(challengeMethod === "sms" ? "1\n" : "2\n");
    }

    // Handle challenge code input
    if (challengeCode) {
      pythonProcess.stdin.write(challengeCode + "\n");
    }

    pythonProcess.stdin.end();
  });
}
