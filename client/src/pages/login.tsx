import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Instagram, User, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import SessionReuseModal from "@/components/modals/session-reuse-modal";
import TwoFactorModal from "@/components/modals/two-factor-modal";
import ChallengeMethodModal from "@/components/modals/challenge-method-modal";
import ChallengeCodeModal from "@/components/modals/challenge-code-modal";

interface LoginResponse {
  success: boolean;
  message?: string;
  requiresTwoFactor?: boolean;
  requiresChallenge?: boolean;
  challengeMethods?: Array<{ type: string; destination: string }>;
  sessionExists?: boolean;
  sessionFile?: string;
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Modal states
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showChallengeMethodModal, setShowChallengeMethodModal] = useState(false);
  const [showChallengeCodeModal, setShowChallengeCodeModal] = useState(false);
  const [challengeMethods, setChallengeMethods] = useState<Array<{ type: string; destination: string }>>([]);
  const [selectedChallengeMethod, setSelectedChallengeMethod] = useState<string>("");
  const [sessionFile, setSessionFile] = useState<string>("");

  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; reuseSession?: boolean; twoFactorCode?: string; challengeMethod?: string; challengeCode?: string }) => {
      const response = await apiRequest("POST", "/api/login", data);
      return response.json() as Promise<LoginResponse>;
    },
    onSuccess: (data) => {
      if (data.success) {
          setStatusMessage({
            type: "success",
            message: data.message || "Login successful!"
          });
          toast({
            title: "Success",
            description: "Successfully logged in to Instagram!",
          });
          // Redirect to dashboard after successful login
          setTimeout(() => {
            window.location.href = "/dashboard";
          }, 1500);
        } else {
        if (data.sessionExists) {
          setSessionFile(data.sessionFile || "");
          setShowSessionModal(true);
        } else if (data.requiresTwoFactor) {
          setShow2FAModal(true);
          setStatusMessage({ type: "info", message: "Two-factor authentication required" });
        } else if (data.requiresChallenge) {
          setChallengeMethods(data.challengeMethods || []);
          setShowChallengeMethodModal(true);
          setStatusMessage({ type: "info", message: "Security challenge required" });
        }
      }
    },
    onError: (error) => {
      setStatusMessage({ type: "error", message: error.message });
      toast({
        title: "Login Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setStatusMessage({ type: "error", message: "Please enter both username and password" });
      return;
    }
    setStatusMessage({ type: "info", message: "Processing login request..." });
    loginMutation.mutate({ username: username.trim(), password });
  };

  const handleSessionReuse = (reuse: boolean) => {
    setShowSessionModal(false);
    loginMutation.mutate({ username, password, reuseSession: reuse });
  };

  const handleTwoFactorSubmit = (code: string) => {
    loginMutation.mutate({ username, password, twoFactorCode: code });
  };

  const handleChallengeMethodSelect = (method: string) => {
    setSelectedChallengeMethod(method);
    setShowChallengeMethodModal(false);
    setShowChallengeCodeModal(true);
    loginMutation.mutate({ username, password, challengeMethod: method });
  };

  const handleChallengeCodeSubmit = (code: string) => {
    loginMutation.mutate({ username, password, challengeMethod: selectedChallengeMethod, challengeCode: code });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
              <Instagram className="text-white text-2xl w-8 h-8" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Instagram Login</h1>
            <p className="text-gray-600 text-sm">Enter your credentials to authenticate</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Username Input */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                Username
              </Label>
              <div className="relative">
                <Input
                  type="text"
                  id="username"
                  placeholder="Enter your Instagram username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pr-10"
                  required
                />
                <User className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 h-8 w-8 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>

          {/* Status Area */}
          {statusMessage && (
            <div className="mt-6">
              <div
                className={`p-4 rounded-lg border ${
                  statusMessage.type === "success"
                    ? "bg-green-50 border-green-200 text-green-800"
                    : statusMessage.type === "error"
                    ? "bg-red-50 border-red-200 text-red-800"
                    : "bg-blue-50 border-blue-200 text-blue-800"
                }`}
              >
                <div className="flex items-center">
                  {statusMessage.type === "success" && (
                    <div className="w-4 h-4 rounded-full bg-green-500 mr-3"></div>
                  )}
                  {statusMessage.type === "error" && (
                    <div className="w-4 h-4 rounded-full bg-red-500 mr-3"></div>
                  )}
                  {statusMessage.type === "info" && (
                    <div className="w-4 h-4 rounded-full bg-blue-500 mr-3"></div>
                  )}
                  <span className="font-medium">{statusMessage.message}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <SessionReuseModal
        open={showSessionModal}
        onOpenChange={setShowSessionModal}
        sessionFile={sessionFile}
        onConfirm={handleSessionReuse}
      />

      <TwoFactorModal
        open={show2FAModal}
        onOpenChange={setShow2FAModal}
        onSubmit={handleTwoFactorSubmit}
      />

      <ChallengeMethodModal
        open={showChallengeMethodModal}
        onOpenChange={setShowChallengeMethodModal}
        methods={challengeMethods}
        onSelect={handleChallengeMethodSelect}
      />

      <ChallengeCodeModal
        open={showChallengeCodeModal}
        onOpenChange={setShowChallengeCodeModal}
        method={selectedChallengeMethod}
        onSubmit={handleChallengeCodeSubmit}
      />
    </div>
  );
}