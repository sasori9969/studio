"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield, UserPlus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Participant {
  id: string;
  name: string;
  attendedDates: string[]; // Store dates as ISO strings 'YYYY-MM-DD'
}

export default function AktivCupPage() {
  const { toast } = useToast();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Load state from localStorage on initial render
  useEffect(() => {
    try {
      const savedParticipants = localStorage.getItem("aktivCupParticipants");
      if (savedParticipants) {
        setParticipants(JSON.parse(savedParticipants));
      }
    } catch (error) {
      console.error("Fehler beim Laden der Teilnehmer:", error);
      toast({ title: "Ladefehler", description: "Daten konnten nicht geladen werden.", variant: "destructive" });
    }
  }, []);

  // Save state to localStorage whenever participants change
  useEffect(() => {
    try {
      localStorage.setItem("aktivCupParticipants", JSON.stringify(participants));
    } catch (error) {
      console.error("Fehler beim Speichern der Teilnehmer:", error);
    }
  }, [participants]);

  const handleAddParticipant = () => {
    if (newParticipantName.trim() === "") {
      toast({ title: "Fehler", description: "Der Name darf nicht leer sein.", variant: "destructive" });
      return;
    }
    if (participants.some(p => p.name.toLowerCase() === newParticipantName.trim().toLowerCase())) {
      toast({ title: "Fehler", description: "Ein Teilnehmer mit diesem Namen existiert bereits.", variant: "destructive" });
      return;
    }
    const newParticipant: Participant = {
      id: crypto.randomUUID(),
      name: newParticipantName.trim(),
      attendedDates: [],
    };
    setParticipants(prev => [...prev, newParticipant]);
    setNewParticipantName("");
    toast({ title: "Erfolg", description: `Teilnehmer "${newParticipant.name}" hinzugefügt.` });
  };

  const handleRemoveParticipant = (id: string) => {
    setParticipants(prev => prev.filter(p => p.id !== id));
    if (selectedParticipantId === id) {
      setSelectedParticipantId(null);
    }
    toast({ title: "Teilnehmer entfernt", variant: "destructive" });
  };

  const handleDateToggle = (date: Date) => {
    if (!selectedParticipantId) {
      toast({ title: "Achtung", description: "Bitte wählen Sie zuerst einen Teilnehmer aus.", variant: "default" });
      return;
    }
    const dateString = date.toISOString().split('T')[0]; // 'YYYY-MM-DD'
    setParticipants(prev =>
      prev.map(p => {
        if (p.id === selectedParticipantId) {
          const attended = p.attendedDates.includes(dateString);
          const newDates = attended
            ? p.attendedDates.filter(d => d !== dateString)
            : [...p.attendedDates, dateString];
          return { ...p, attendedDates: newDates };
        }
        return p;
      })
    );
  };

  const trainingDays = useMemo(() => {
    const days: Date[] = [];
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
      const dayOfWeek = date.getDay(); // 0=So, 1=Mo, ..., 3=Mi, ..., 6=Sa
      if (dayOfWeek === 3 || dayOfWeek === 6 || dayOfWeek === 0) {
        days.push(new Date(date));
      }
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentMonth]);

  const selectedParticipant = participants.find(p => p.id === selectedParticipantId);

  return (
    <div className="flex flex-col items-center space-y-6">
      <Card className="w-full max-w-3xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center flex items-center justify-center gap-2">
            <Shield className="text-accent" /> Aktiv-Cup
          </CardTitle>
          <CardDescription className="text-center">Teilnehmer hinzufügen und Anwesenheit an Trainingstagen erfassen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">1. Teilnehmer verwalten</h3>
            <div className="flex gap-2">
              <Input placeholder="Neuer Teilnehmername" value={newParticipantName} onChange={e => setNewParticipantName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddParticipant()} />
              <Button onClick={handleAddParticipant}><UserPlus className="mr-2 h-4 w-4" /> Hinzufügen</Button>
            </div>
            <div className="space-y-2 pt-2">
              {participants.map(p => (
                <div key={p.id} onClick={() => setSelectedParticipantId(p.id)} className={cn("flex justify-between items-center p-2 rounded-md cursor-pointer border", selectedParticipantId === p.id ? "bg-primary/10 border-primary" : "hover:bg-muted/50")}>
                  <span>{p.name}</span>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleRemoveParticipant(p.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">2. Anwesenheit eintragen für: <span className="text-primary">{selectedParticipant?.name || '...'}</span></h3>
            <p className="text-sm text-muted-foreground">Klicken Sie auf einen Tag, um die Teilnahme zu speichern. Aktueller Monat: {currentMonth.toLocaleString('de-DE', { month: 'long', year: 'numeric' })}</p>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
              {trainingDays.map(day => {
                const dateString = day.toISOString().split('T')[0];
                const isAttended = selectedParticipant?.attendedDates.includes(dateString);
                return (
                  <Button key={dateString} variant={isAttended ? "default" : "outline"} onClick={() => handleDateToggle(day)} className="flex flex-col h-16">
                    <span className="text-xs">{day.toLocaleDateString('de-DE', { weekday: 'short' })}</span>
                    <span className="text-lg font-bold">{day.getDate()}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

