import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, MessageSquare, Mail } from "lucide-react";

interface ChallengeMethodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  methods: Array<{ type: string; destination: string }>;
  onSelect: (method: string) => void;
}

export default function ChallengeMethodModal({
  open,
  onOpenChange,
  methods,
  onSelect,
}: ChallengeMethodModalProps) {
  const [selectedMethod, setSelectedMethod] = useState("");

  const handleSelect = () => {
    if (selectedMethod) {
      onSelect(selectedMethod);
      setSelectedMethod("");
    }
  };

  const getMethodIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "sms":
        return <MessageSquare className="text-gray-400 w-5 h-5" />;
      case "email":
        return <Mail className="text-gray-400 w-5 h-5" />;
      default:
        return <MessageSquare className="text-gray-400 w-5 h-5" />;
    }
  };

  const getMethodLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case "sms":
        return "SMS";
      case "email":
        return "Email";
      default:
        return type.toUpperCase();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
              <AlertTriangle className="text-purple-600 w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Security Challenge
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                Choose verification method
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-gray-700">
            Instagram requires additional verification. Please choose how you'd like to receive your code:
          </p>
          
          <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod}>
            {methods.map((method, index) => (
              <div key={index} className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <RadioGroupItem value={method.type} id={`method-${index}`} />
                <Label htmlFor={`method-${index}`} className="flex items-center cursor-pointer flex-1">
                  {getMethodIcon(method.type)}
                  <div className="ml-3">
                    <div className="font-medium text-gray-900">
                      {getMethodLabel(method.type)}
                    </div>
                    <div className="text-sm text-gray-600">
                      Send code to {method.destination}
                    </div>
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="flex space-x-3">
            <Button
              onClick={handleSelect}
              disabled={!selectedMethod}
              className="flex-1"
            >
              Send Code
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
