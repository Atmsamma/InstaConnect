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
import { Shield } from "lucide-react";

interface TwoFactorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (code: string) => void;
}

export default function TwoFactorModal({
  open,
  onOpenChange,
  onSubmit,
}: TwoFactorModalProps) {
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      onSubmit(code.trim());
      setCode("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mr-4">
              <Shield className="text-orange-600 w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Two-Factor Authentication
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                Enter your 2FA code
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="twoFactorCode" className="block text-sm font-medium text-gray-700 mb-2">
              Authentication Code
            </Label>
            <Input
              type="text"
              id="twoFactorCode"
              placeholder="Enter 6-digit code"
              maxLength={6}
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
        </form>
      </DialogContent>
    </Dialog>
  );
}
