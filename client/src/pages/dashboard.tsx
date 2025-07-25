import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, Title } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Square, RefreshCw, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BotStatus {
  isRunning: boolean;
  logs: string[];
  error?: string;
}

export default function Dashboard() {
  const [botStatus, setBotStatus] = useState<BotStatus>({
    isRunning: false,
    logs: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [triggerMessages, setTriggerMessages] = useState<any[]>([]);
  const [loadingTriggerMessages, setLoadingTriggerMessages] = useState(false);
  const { toast } = useToast();

  const startBot = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/bot/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (result.success) {
        setBotStatus(prev => ({ 
          ...prev, 
          isRunning: true, 
          error: undefined 
        }));
        toast({
          title: "Bot Started",
          description: "Instagram bot is now running",
        });
        // Start polling for logs
        pollLogs();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start bot",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stopBot = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/bot/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (result.success) {
        setBotStatus(prev => ({ 
          ...prev, 
          isRunning: false 
        }));
        toast({
          title: "Bot Stopped",
          description: "Instagram bot has been stopped",
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to stop bot",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const pollLogs = async () => {
    try {
      const response = await fetch("/api/bot/logs");
      const result = await response.json();

      if (result.success) {
        setBotStatus(prev => ({
          ...prev,
          logs: result.logs,
          isRunning: result.isRunning,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    }
  };

  const refreshLogs = () => {
    pollLogs();
  };

  // Poll logs every 5 seconds when bot is running
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (botStatus.isRunning) {
      interval = setInterval(pollLogs, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [botStatus.isRunning]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Instagram Bot Dashboard</h1>
          <p className="text-gray-600">Monitor and control your Instagram DM bot</p>
        </div>

        {/* Bot Control Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Bot Control</h2>
                <CardDescription>
                  Start or stop the Instagram bot that monitors DMs
                </CardDescription>
              </div>
              <Badge 
                variant={botStatus.isRunning ? "default" : "secondary"}
                className={botStatus.isRunning ? "bg-green-500" : ""}
              >
                {botStatus.isRunning ? "Running" : "Stopped"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button
                onClick={startBot}
                disabled={isLoading || botStatus.isRunning}
                className="flex-1"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Bot
              </Button>
              <Button
                onClick={stopBot}
                disabled={isLoading || !botStatus.isRunning}
                variant="destructive"
                className="flex-1"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop Bot
              </Button>
              <Button
                onClick={refreshLogs}
                disabled={isLoading}
                variant="outline"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logs Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Bot Logs</h2>
                <CardDescription>
                  Real-time logs from the Instagram bot
                </CardDescription>
              </div>
              {botStatus.error && (
                <Badge variant="destructive">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Error
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96 w-full border rounded-md p-4 bg-gray-900 text-gray-100 font-mono text-sm">
              {botStatus.logs.length > 0 ? (
                <div className="space-y-1">
                  {botStatus.logs.map((log, index) => (
                    <div key={index} className="whitespace-pre-wrap">
                      {log}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-400 italic">
                  No logs available. Start the bot to see activity.
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
        {/* Trigger Messages Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Trigger Messages
                <Badge variant="outline">{triggerMessages.length}</Badge>
              </CardTitle>
              <CardDescription>
                Messages that triggered the bot to respond
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={fetchTriggerMessages} 
                disabled={loadingTriggerMessages}
                className="mb-4"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Messages
              </Button>

              <ScrollArea className="h-64">
                {triggerMessages.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No trigger messages yet</p>
                ) : (
                  <div className="space-y-3">
                    {triggerMessages.map((msg, index) => (
                      <div key={msg.message_id || index} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">@{msg.username}</span>
                          <span className="text-sm text-gray-500">{msg.created_at}</span>
                        </div>
                        <p className="text-sm mb-2">{msg.text}</p>
                        <div className="flex gap-2 flex-wrap mb-2">
                          {msg.triggered_words?.map((word: string) => (
                            <Badge key={word} variant="secondary" className="text-xs">
                              {word}
                            </Badge>
                          ))}
                          {msg.reply_sent && (
                            <Badge variant="outline" className="text-xs">
                              ✓ Replied
                            </Badge>
                          )}
                          {msg.has_media_share && (
                            <Badge variant="outline" className="text-xs">
                              📷 Media
                            </Badge>
                          )}
                        </div>
                        {/* Raw Instagram Data Toggle */}
                        {msg.raw_instagram_data && (
                          <details className="mt-2">
                            <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                              View Raw Instagram Data
                            </summary>
                            <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-auto max-h-32">
                              {JSON.stringify(msg.raw_instagram_data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}