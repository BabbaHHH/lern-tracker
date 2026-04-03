"use client";

import { useState, useEffect, useCallback } from "react";
import { NavBar } from "@/components/nav-bar";
import { getCalendarEvents, addCalendarEvent, removeCalendarEvent, getExamDate, setExamDate } from "@/lib/store";
import { CalendarEvent } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, isSameMonth, isSameDay, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Trash2, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

const EVENT_TYPES = [
  { value: "ag", label: "AG", color: "bg-blue-100 text-blue-700" },
  { value: "rep", label: "Kiss Rep", color: "bg-purple-100 text-purple-700" },
  { value: "kaiser", label: "Kaiserseminar", color: "bg-indigo-100 text-indigo-700" },
  { value: "probeexamen", label: "Probeexamen", color: "bg-orange-100 text-orange-700" },
  { value: "klausur", label: "Klausur", color: "bg-red-100 text-red-700" },
  { value: "urlaub", label: "Urlaub", color: "bg-green-100 text-green-700" },
  { value: "frei", label: "Freier Tag", color: "bg-gray-100 text-gray-700" },
  { value: "sport", label: "Sport", color: "bg-teal-100 text-teal-700" },
] as const;

function getEventStyle(eventType: string) {
  return EVENT_TYPES.find(e => e.value === eventType) || EVENT_TYPES[EVENT_TYPES.length - 1];
}

export default function KalenderPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [newEventType, setNewEventType] = useState<string>("ag");
  const [newEventLabel, setNewEventLabel] = useState("");
  const [examDateStr, setExamDateStr] = useState("");

  useEffect(() => {
    setEvents(getCalendarEvents());
    setExamDateStr(getExamDate());
  }, []);

  const today = new Date();
  const monthStart = startOfMonth(addMonths(today, monthOffset));
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });
  const examDate = parseISO(examDateStr || "2026-10-26");

  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(format(date, "yyyy-MM-dd"));
    setNewEventLabel("");
    setDialogOpen(true);
  }, []);

  const handleAddEvent = useCallback(() => {
    if (!selectedDate) return;
    const style = getEventStyle(newEventType);
    const updated = addCalendarEvent({
      date: selectedDate,
      eventType: newEventType as CalendarEvent["eventType"],
      label: newEventLabel || style.label,
      recurring: false,
    });
    setEvents(updated);
    setDialogOpen(false);
  }, [selectedDate, newEventType, newEventLabel]);

  const handleRemoveEvent = useCallback((id: string) => {
    const updated = removeCalendarEvent(id);
    setEvents(updated);
  }, []);

  const handleExamDateChange = useCallback((value: string) => {
    setExamDateStr(value);
    setExamDate(value);
  }, []);

  const getDayEvents = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return events.filter(e => e.date === dateStr);
  };

  return (
    <>
      <NavBar />
      <main className="flex-1 pb-20 pt-4 md:pt-20 px-4 max-w-4xl mx-auto w-full">
        <h1 className="text-xl font-bold mb-4">Kalender</h1>

        {/* Examenstermin */}
        <Card className="mb-4">
          <CardContent className="pt-4 flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-medium">Examenstermin:</span>
            <Input
              type="date"
              value={examDateStr}
              onChange={(e) => handleExamDateChange(e.target.value)}
              className="w-auto"
            />
          </CardContent>
        </Card>

        {/* Monats-Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={() => setMonthOffset(m => m - 1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold">
            {format(monthStart, "MMMM yyyy", { locale: de })}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => setMonthOffset(m => m + 1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Kalender-Grid */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {/* Wochentag-Header */}
          <div className="grid grid-cols-7 border-b">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
            ))}
          </div>

          {/* Tage */}
          <div className="grid grid-cols-7">
            {calDays.map(day => {
              const dayEvents = getDayEvents(day);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isToday = isSameDay(day, today);
              const isExam = isSameDay(day, examDate);
              const isFree = dayEvents.some(e => ["urlaub", "frei"].includes(e.eventType));

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "relative min-h-[60px] md:min-h-[80px] p-1 border-b border-r text-left transition-colors hover:bg-gray-50",
                    !isCurrentMonth && "bg-gray-50/50 text-gray-300",
                    isFree && "bg-green-50/50",
                  )}
                >
                  <span className={cn(
                    "text-xs font-medium",
                    isToday && "bg-emerald-600 text-white rounded-full w-6 h-6 flex items-center justify-center",
                    isExam && "bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center",
                  )}>
                    {format(day, "d")}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 2).map(event => {
                      const style = getEventStyle(event.eventType);
                      return (
                        <div key={event.id} className={cn("text-[10px] rounded px-1 truncate", style.color)}>
                          {event.label}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-gray-400">+{dayEvents.length - 2}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Event-Liste für ausgewählten Monat */}
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Termine diesen Monat</CardTitle>
          </CardHeader>
          <CardContent>
            {events
              .filter(e => {
                const eDate = parseISO(e.date);
                return isSameMonth(eDate, monthStart);
              })
              .sort((a, b) => a.date.localeCompare(b.date))
              .map(event => {
                const style = getEventStyle(event.eventType);
                return (
                  <div key={event.id} className="flex items-center gap-2 py-1.5 border-b last:border-0">
                    <Badge className={cn("text-xs shrink-0", style.color)}>{style.label}</Badge>
                    <span className="text-sm flex-1">{event.label}</span>
                    <span className="text-xs text-gray-400">{format(parseISO(event.date), "dd.MM.")}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemoveEvent(event.id)}
                    >
                      <Trash2 className="h-3 w-3 text-gray-400" />
                    </Button>
                  </div>
                );
              })}
            {events.filter(e => isSameMonth(parseISO(e.date), monthStart)).length === 0 && (
              <p className="text-sm text-gray-400">Keine Termine. Klicke auf einen Tag um einen hinzuzufügen.</p>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Neuen Termin Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Termin am {selectedDate && format(parseISO(selectedDate), "dd. MMMM yyyy", { locale: de })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Typ</label>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map(et => (
                  <button
                    key={et.value}
                    onClick={() => {
                      setNewEventType(et.value);
                      if (!newEventLabel) setNewEventLabel(et.label);
                    }}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border transition-all",
                      newEventType === et.value ? cn(et.color, "ring-2 ring-offset-1 ring-gray-300") : "bg-gray-50"
                    )}
                  >
                    {et.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Bezeichnung</label>
              <Input
                value={newEventLabel}
                onChange={(e) => setNewEventLabel(e.target.value)}
                placeholder="z.B. AG Zivilrecht"
              />
            </div>
            <Button onClick={handleAddEvent} className="w-full bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              Termin hinzufügen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
