import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Key } from "lucide-react";

interface ChallengeCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: string;
  onSubmit: (code: string) => void;
}

export default function ChallengeCodeModal({
  open,
  onOpenChange,
  method,
  onSubmit,
}: ChallengeCodeModalProps) {
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      onSubmit(code.trim());
      setCode("");
    }
  };

  const getMethodText = (method: string) => {
    switch (method.toLowerCase()) {
      case "sms":
        return "Code sent via SMS";
      case "email":
        return "Code sent via Email";
      default:
        return `Code sent via ${method}`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
              <Key className="text-green-600 w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Enter Challenge Code
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                {getMethodText(method)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-gray-700">
            Please enter the verification code you received:
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="challengeCode" className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code
              </Label>
              <Input
                type="text"
                id="challengeCode"
                placeholder="Enter verification code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-center text-lg tracking-widest"
                required
              />
            </div>
            <div className="flex space-x-3">
              <Button type="submit" className="flex-1">
                Verify
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
            <Button
              type="button"
              variant="link"
              className="w-full text-primary text-sm"
            >
              Didn't receive code? Resend
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
