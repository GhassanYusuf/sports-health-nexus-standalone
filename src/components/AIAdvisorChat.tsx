import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Target, Activity, Apple, Zap, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import aiAvatar from "@/assets/ai-avatar.jpg";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  suggestions?: string[];
}

interface AIAdvisorChatProps {
  context?: {
    userGender?: string;
    goals?: string;
    availableActivities?: any[];
    selectedActivities?: string[];
    conflicts?: string[];
  };
  onActivityRecommendation?: (activityIds: string[]) => void;
}

const AIAdvisorChat: React.FC<AIAdvisorChatProps> = ({ 
  context,
  onActivityRecommendation 
}) => {
  const getInitialMessage = () => {
    if (context) {
      return {
        id: '1',
        text: "Hi! I'm here to help you build the perfect custom package. I can analyze your preferences, goals, and available activities to recommend the best combination for you. What specific fitness goals are you looking to achieve?",
        sender: 'ai' as const,
        timestamp: new Date(),
        suggestions: ["Help me choose activities", "Avoid schedule conflicts", "Match my fitness goals", "Optimize for my gender preferences"]
      };
    }
    return {
      id: '1',
      text: "Hello! I'm your personal fitness AI advisor. I'm here to help you achieve your health and fitness goals. What would you like to work on today?",
      sender: 'ai' as const,
      timestamp: new Date(),
      suggestions: ["Set fitness goals", "Track my progress", "Find nutrition advice", "Plan my workout"]
    };
  };

  const [messages, setMessages] = useState<Message[]>([getInitialMessage()]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const quickMetrics = [
    { icon: Target, label: "Set Goals", value: "Weight Loss", color: "bg-primary" },
    { icon: Activity, label: "Current Level", value: "Intermediate", color: "bg-wellness" },
    { icon: Apple, label: "Diet Plan", value: "Balanced", color: "bg-energy" },
    { icon: Zap, label: "Workout Style", value: "HIIT", color: "bg-info" },
  ];

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Call Ollama via edge function
      const { data, error } = await supabase.functions.invoke('ollama-chat', {
        body: { 
          messages: messages.concat(userMessage).map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text
          })),
          model: 'llama3.2:latest'
        }
      });

      if (error) throw error;

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: data.message || "I'm sorry, I couldn't process that request.",
        sender: 'ai',
        timestamp: new Date(),
        suggestions: ["Tell me more", "Set a goal", "Track progress", "Find activities"]
      };

      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error calling AI:', error);
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive"
      });
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble connecting right now. Please try again in a moment.",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <Card className="bg-gradient-hero text-white">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/30">
              <img 
                src={aiAvatar} 
                alt="AI Advisor" 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <CardTitle className="text-xl">AI Fitness Advisor</CardTitle>
              <p className="text-white/80">Your personalized health & fitness companion</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickMetrics.map((metric, index) => (
          <Card key={metric.label} className={`animate-fade-in`} style={{ animationDelay: `${index * 100}ms` }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${metric.color} text-white`}>
                  <metric.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{metric.label}</p>
                  <p className="font-semibold text-sm truncate">{metric.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chat Interface */}
      <Card className="min-h-[500px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Chat with Your AI Advisor
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 space-y-4 mb-4 overflow-y-auto max-h-96">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-border">
                    <img src={aiAvatar} alt="AI" className="w-full h-full object-cover" />
                  </div>
                )}
                
                <div className={`max-w-[70%] space-y-2 ${message.sender === 'user' ? 'order-first' : ''}`}>
                  <div className={`p-3 rounded-2xl ${
                    message.sender === 'user' 
                      ? 'bg-primary text-primary-foreground ml-auto' 
                      : 'bg-muted'
                  }`}>
                    <p className="text-sm">{message.text}</p>
                  </div>
                  
                  {message.suggestions && (
                    <div className="flex flex-wrap gap-2">
                      {message.suggestions.map((suggestion, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => handleSuggestionClick(suggestion)}
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {message.sender === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask me about fitness, nutrition, or goals..."
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
              className="flex-1"
              disabled={isLoading}
            />
            <Button onClick={handleSendMessage} size="icon" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recommended for You</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
              <h4 className="font-semibold mb-2">Custom Workout Plan</h4>
              <p className="text-sm text-muted-foreground mb-3">Get a personalized 4-week program</p>
              <Badge variant="secondary">AI Generated</Badge>
            </div>
            <div className="p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
              <h4 className="font-semibold mb-2">Nutrition Tracking</h4>
              <p className="text-sm text-muted-foreground mb-3">Log meals and track macros</p>
              <Badge variant="secondary">Smart Suggestions</Badge>
            </div>
            <div className="p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
              <h4 className="font-semibold mb-2">Progress Analytics</h4>
              <p className="text-sm text-muted-foreground mb-3">Detailed insights on your journey</p>
              <Badge variant="secondary">Data Driven</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIAdvisorChat;