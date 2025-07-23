import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save } from "lucide-react";

interface SessionReuseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionFile: string;
  onConfirm: (reuse: boolean) => void;
}

export default function SessionReuseModal({
  open,
  onOpenChange,
  sessionFile,
  onConfirm,
}: SessionReuseModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
              <Save className="text-blue-600 w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Session Found
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                Reuse saved session?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-gray-700">
            Found existing session for <strong>{sessionFile}</strong>. 
            Would you like to reuse it or log in fresh?
          </p>
          <div className="flex space-x-3">
            <Button
              onClick={() => onConfirm(true)}
              className="flex-1"
            >
              Yes, Reuse
            </Button>
            <Button
              onClick={() => onConfirm(false)}
              variant="outline"
              className="flex-1"
            >
              No, Fresh Login
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
