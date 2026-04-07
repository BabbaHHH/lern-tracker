"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPromptById } from "@/lib/prompts";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import { getProgress, setTopicProgress } from "@/lib/store";
import { Send, Bot, User, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  progressSuggestions?: { topicId: string; percent: number }[];
}

export function CheckinChat({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hey! Wie war dein Lerntag heute? Was hast du bearbeitet?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // System prompt + Kontext aufbauen
      const checkinPrompt = getPromptById("checkin");
      const progress = getProgress();
      const leafTopics = getLeafTopics(TOPICS);

      // Aktuellen Lernstand als Kontext mitgeben
      const progressContext = leafTopics
        .filter(t => (progress[t.id]?.percent || 0) > 0)
        .map(t => `${t.label}: ${progress[t.id]?.percent}%`)
        .join(", ");

      const topicList = leafTopics
        .map(t => `${t.id}: ${t.label} (${t.area})`)
        .join("\n");

      const systemMsg = `${checkinPrompt?.prompt || "Du bist ein Lern-Coach."}

Aktueller Lernstand des Kandidaten:
${progressContext || "Noch kein Fortschritt erfasst."}

Verfügbare Topic-IDs für progressSuggestions:
${topicList}`;

      const apiMessages = [
        { role: "system" as const, content: systemMsg },
        ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: input.trim() },
      ];

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, tier: "cheap" }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: `Fehler: ${data.error}` },
        ]);
      } else {
        // Versuche JSON zu parsen
        let parsed: { message?: string; progressSuggestions?: { topicId: string; percent: number }[] } | null = null;
        try {
          // Suche nach JSON im Reply
          const jsonMatch = data.reply.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        } catch { /* Kein JSON — normaler Text */ }

        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: parsed?.message || data.reply,
          progressSuggestions: parsed?.progressSuggestions,
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Verbindungsfehler. Ist der API-Key konfiguriert?" },
      ]);
    }

    setLoading(false);
  }, [input, loading, messages]);

  const applySuggestion = useCallback((topicId: string, percent: number) => {
    setTopicProgress(topicId, percent, "ai");
    setAppliedSuggestions(prev => new Set([...prev, topicId]));
  }, []);

  const getTopicLabel = (topicId: string) => {
    return TOPICS.find(t => t.id === topicId)?.label || topicId;
  };

  return (
    <div className="flex flex-col h-full max-h-[70vh]">
      {/* Chat Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i}>
            <div className={cn(
              "flex gap-2 items-start",
              msg.role === "user" ? "flex-row-reverse" : ""
            )}>
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                msg.role === "user" ? "bg-indigo-100" : "bg-blue-100"
              )}>
                {msg.role === "user" ? <User className="h-4 w-4 text-indigo-700" /> : <Bot className="h-4 w-4 text-blue-700" />}
              </div>
              <div className={cn(
                "rounded-xl px-3 py-2 text-sm max-w-[80%]",
                msg.role === "user" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-800"
              )}>
                {msg.content}
              </div>
            </div>

            {/* Progress-Vorschläge */}
            {msg.progressSuggestions && msg.progressSuggestions.length > 0 && (
              <div className="ml-9 mt-2 space-y-1">
                {msg.progressSuggestions.map(s => (
                  <div key={s.topicId} className="flex items-center gap-2 bg-indigo-50 rounded-lg px-3 py-1.5">
                    <span className="text-xs flex-1">
                      {getTopicLabel(s.topicId)}: <strong>{s.percent}%</strong>
                    </span>
                    {appliedSuggestions.has(s.topicId) ? (
                      <Badge className="bg-indigo-100 text-indigo-700 text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        Übernommen
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                        onClick={() => applySuggestion(s.topicId, s.percent)}
                      >
                        Übernehmen
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 items-center">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
              <Loader2 className="h-4 w-4 text-blue-700 animate-spin" />
            </div>
            <div className="bg-gray-100 rounded-xl px-3 py-2 text-sm text-gray-400">
              Denkt nach...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Was hast du heute gelernt?"
          disabled={loading}
          autoFocus
        />
        <Button onClick={sendMessage} disabled={loading || !input.trim()} size="icon" className="bg-indigo-600 hover:bg-indigo-700">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
