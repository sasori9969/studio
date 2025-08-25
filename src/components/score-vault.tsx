"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ArrowRight,
  BrainCircuit,
  FileDown,
  Loader2,
  Pencil,
  RotateCcw,
  Swords,
  Trophy,
  Users,
  FileText,
  User,
  Shield,
  PlusCircle,
  Trash2,
  UserPlus,
  Copy,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { exportToCsv, exportToPdf } from "@/lib/utils";
import type { Participant, TeamResults, PairingResult, CompetitionType, RankedParticipant, CombinedTeam, CombinedParticipant, CombinedResults, CombinedSetupFormData } from "@/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const teamSetupSchema = z.object({
  eventName: z.string().min(1, "Event-Name ist erforderlich."),
  homeTeamName: z.string().min(1, "Name des Heimteams ist erforderlich."),
  visitingTeamName: z.string().min(1, "Name des Gastteams ist erforderlich."),
  participantsPerTeam: z.number().min(1).max(20),
});

const individualSetupSchema = z.object({
  eventName: z.string().min(1, "Event-Name ist erforderlich."),
});

const combinedSetupSchema = z.object({
    eventName: z.string().min(1, "Event-Name ist erforderlich."),
    participants: z.array(z.object({
        id: z.string(),
        firstName: z.string().min(1, "Vorname ist erforderlich."),
        lastName: z.string().min(1, "Nachname ist erforderlich."),
    })),
    teams: z.array(z.object({
        id: z.string(),
        name: z.string().min(1, "Team-Name ist erforderlich."),
    }))
});

type TeamSetupFormData = z.infer<typeof teamSetupSchema>;
type IndividualSetupFormData = z.infer<typeof individualSetupSchema>;


export default function ScoreVault() {
  const [step, setStep] = useState(0); // 0: type selection, 1: setup, 2: entry, 3: results
  const [competitionType, setCompetitionType] = useState<CompetitionType | null>(null);
  const { toast } = useToast();

  // Team Competition State
  const {
    control: teamControl,
    handleSubmit: handleTeamSubmit,
    watch: watchTeamEvent,
    formState: { errors: teamErrors },
  } = useForm<TeamSetupFormData>({
    resolver: zodResolver(teamSetupSchema),
    defaultValues: {
      eventName: "",
      homeTeamName: "Heimteam",
      visitingTeamName: "Gastteam",
      participantsPerTeam: 3,
    },
  });
  const teamEventData = watchTeamEvent();

  // Individual Competition State
  const {
    control: individualControl,
    handleSubmit: handleIndividualSubmit,
    watch: watchIndividualEvent,
    formState: { errors: individualErrors },
  } = useForm<IndividualSetupFormData>({
    resolver: zodResolver(individualSetupSchema),
    defaultValues: {
      eventName: "",
    },
  });
  const individualEventData = watchIndividualEvent();

  // Combined Competition State
  const {
    control: combinedControl,
    handleSubmit: handleCombinedSubmit,
    watch: watchCombinedEvent,
    formState: { errors: combinedErrors },
  } = useForm<CombinedSetupFormData>({
      resolver: zodResolver(combinedSetupSchema),
      defaultValues: {
          eventName: "",
          participants: [],
          teams: [],
      },
  });
  const combinedEventData = watchCombinedEvent();
  const { fields: combinedParticipantFields, append: appendCombinedParticipant, remove: removeCombinedParticipant } = useFieldArray({ control: combinedControl, name: "participants" });
  const { fields: combinedTeamFields, append: appendCombinedTeam, remove: removeCombinedTeam } = useFieldArray({ control: combinedControl, name: "teams" });
  
  const [combinedEntries, setCombinedEntries] = useState<{
    individual: CombinedParticipant[];
    teams: CombinedTeam[];
  }>({ individual: [], teams: [] });


  const eventData = useMemo(() => {
    switch(competitionType) {
        case 'team': return teamEventData;
        case 'individual': return individualEventData;
        case 'combined': return combinedEventData;
        default: return { eventName: "" };
    }
  }, [competitionType, teamEventData, individualEventData, combinedEventData]);


  // Entry Step State
  const [homeTeamParticipants, setHomeTeamParticipants] = useState<Participant[]>([]);
  const [visitingTeamParticipants, setVisitingTeamParticipants] = useState<Participant[]>([]);
  const [individualParticipants, setIndividualParticipants] = useState<Participant[]>([]);

  // Results Step State
  const [teamResults, setTeamResults] = useState<TeamResults | null>(null);
  const [individualResults, setIndividualResults] = useState<RankedParticipant[] | null>(null);
  const [combinedResults, setCombinedResults] = useState<CombinedResults | null>(null);
  const [scoringMethod, setScoringMethod] = useState<"total" | "pairs">("total");
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const allTeamParticipants = useMemo(() => [
    ...homeTeamParticipants.map(p => ({...p, team: teamEventData.homeTeamName})),
    ...visitingTeamParticipants.map(p => ({...p, team: teamEventData.visitingTeamName}))
  ], [homeTeamParticipants, visitingTeamParticipants, teamEventData]);

  const handleCompetitionTypeSelect = (type: CompetitionType) => {
    setCompetitionType(type);
    if (type === 'individual') {
      const initialParticipants = (count: number): Participant[] =>
        Array.from({ length: count }, (_, i) => ({
          id: i + 1,
          firstName: "",
          lastName: "",
          scores: [],
          rawScores: "",
          total: 0,
          isAK: false,
        }));
      setIndividualParticipants(initialParticipants(3));
      setStep(1);
    } else if(type === 'combined') {
       if (combinedParticipantFields.length === 0) {
          appendCombinedParticipant({ id: crypto.randomUUID(), firstName: "", lastName: "" });
          appendCombinedParticipant({ id: crypto.randomUUID(), firstName: "", lastName: "" });
          appendCombinedParticipant({ id: crypto.randomUUID(), firstName: "", lastName: "" });
       }
       if (combinedTeamFields.length === 0) {
          appendCombinedTeam({ id: crypto.randomUUID(), name: "Team 1"});
       }
       setStep(1);
    } else {
      setStep(1);
    }
  };
  
  const handleTeamSetupSubmit = (data: TeamSetupFormData) => {
    const participantsCount = data.participantsPerTeam;
    const initialParticipants = (count: number): Participant[] =>
      Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        firstName: "",
        lastName: "",
        scores: [],
        rawScores: "",
        total: 0,
        isAK: false,
      }));

    setHomeTeamParticipants(initialParticipants(participantsCount));
    setVisitingTeamParticipants(initialParticipants(participantsCount));
    setStep(2);
  };
  
  const handleIndividualSetupSubmit = (_data: IndividualSetupFormData) => {
    setStep(2);
  };

  const handleCombinedSetupSubmit = (data: CombinedSetupFormData) => {
    setCombinedEntries(prevEntries => {
        // Keep existing teams and add new ones
        const existingTeams = prevEntries.teams;
        const newTeamData = data.teams.filter(t => !existingTeams.find(et => et.id === t.id));

        const newTeams: CombinedTeam[] = newTeamData.map(team => ({
            id: team.id,
            name: team.name,
            total: 0,
            participants: Array.from({ length: 3 }, () => ({
                participantId: '',
                scores: [],
                rawScores: "",
                total: 0,
            }))
        }));

        // Filter out deleted teams but keep their data if they are re-added later (maybe not needed)
        const updatedTeams = existingTeams
            .filter(et => data.teams.some(t => t.id === et.id))
            .map(et => ({ ...et, name: data.teams.find(t => t.id === et.id)!.name }));


        // Remove individual entries for participants that no longer exist
        const updatedIndividual = prevEntries.individual.filter(ind => 
            data.participants.some(p => p.id === ind.participantId)
        );

        return {
            teams: [...updatedTeams, ...newTeams],
            individual: updatedIndividual
        };
    });
    setStep(2);
  };

  const addIndividualParticipant = () => {
    setIndividualParticipants(prev => [
        ...prev,
        {
            id: (prev.length > 0 ? Math.max(...prev.map(p => p.id)) : 0) + 1,
            firstName: "",
            lastName: "",
            scores: [],
            rawScores: "",
            total: 0,
            isAK: false,
        }
    ]);
  };

  const deleteIndividualParticipant = (id: number) => {
    setIndividualParticipants(prev => prev.filter(p => p.id !== id));
  };


  const handleParticipantChange = (
    id: number,
    field: keyof Participant,
    value: string | boolean,
    team?: "home" | "visiting"
  ) => {
     const updater = (prev: Participant[]) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p));
      
    if (competitionType === 'team') {
       if (team === "home") {
        setHomeTeamParticipants(updater);
      } else {
        setVisitingTeamParticipants(updater);
      }
    } else {
      setIndividualParticipants(updater);
    }
  };

  const calculateResults = () => {
    const parseScores = (p: { rawScores?: string }) => 
        (p.rawScores || "").split(/[,;\s]+/).filter(s => s.trim() !== '').map(Number).filter(n => !isNaN(n));
    
    const calculateTotal = (scores: number[]) => scores.reduce((a, b) => a + b, 0);

    if (competitionType === 'team') {
      const updatedHomeTeam = homeTeamParticipants.map(p => {
          const scores = parseScores(p);
          return {...p, scores, total: calculateTotal(scores)};
      });
      const updatedVisitingTeam = visitingTeamParticipants.map(p => {
          const scores = parseScores(p);
          return {...p, scores, total: calculateTotal(scores)};
      });
      setHomeTeamParticipants(updatedHomeTeam);
      setVisitingTeamParticipants(updatedVisitingTeam);

      const competingHome = updatedHomeTeam.filter((p) => !p.isAK);
      const competingVisiting = updatedVisitingTeam.filter((p) => !p.isAK);
      const homeTeamTotal = competingHome.reduce((sum, p) => sum + p.total, 0);
      const visitingTeamTotal = competingVisiting.reduce((sum, p) => sum + p.total,0);
      let totalScoreWinner: "home" | "visiting" | "draw" = "draw";
      if (homeTeamTotal > visitingTeamTotal) totalScoreWinner = "home";
      else if (visitingTeamTotal > homeTeamTotal) totalScoreWinner = "visiting";
      let homePairingScore = 0;
      let visitingPairingScore = 0;
      const pairingResults: PairingResult[] = [];
      const numPairs = Math.min(competingHome.length, competingVisiting.length);
      for (let i = 0; i < numPairs; i++) {
        const homeP = competingHome[i];
        const visitingP = competingVisiting[i];
        let winner: "home" | "visiting" | "draw" = "draw";
        if (homeP.total > visitingP.total) { winner = "home"; homePairingScore++; } 
        else if (visitingP.total > homeP.total) { winner = "visiting"; visitingPairingScore++;}
        pairingResults.push({ homeParticipant: homeP, visitingParticipant: visitingP, winner });
      }
      let pairingWinner: "home" | "visiting" | "draw" = "draw";
      if (homePairingScore > visitingPairingScore) pairingWinner = "home";
      else if (visitingPairingScore > homePairingScore) pairingWinner = "visiting";
      setTeamResults({ homeTeamTotal, visitingTeamTotal, totalScoreWinner, pairingResults, homePairingScore, visitingPairingScore, pairingWinner });
    } else if (competitionType === 'individual') {
        const participantsWithScores = individualParticipants.map(p => ({ ...p, scores: parseScores(p) }));
        const ranked = participantsWithScores
            .map(p => {
                const sortedScores = [...p.scores].sort((a, b) => b - a);
                return {
                    ...p,
                    bestScore: sortedScores[0] || 0,
                    secondBestScore: sortedScores[1] || 0,
                };
            })
            .sort((a, b) => {
                if (b.bestScore !== a.bestScore) {
                    return b.bestScore - a.bestScore;
                }
                return b.secondBestScore - a.secondBestScore;
            })
            .map((p, index) => ({
                ...p,
                rank: index + 1,
            }));
        setIndividualResults(ranked);
        setIndividualParticipants(participantsWithScores);
    } else if (competitionType === 'combined') {
        // Calculate team results
        const updatedTeams = combinedEntries.teams.map(team => {
            const updatedParticipants = team.participants.map(p => {
                const scores = parseScores(p);
                return { ...p, scores, total: calculateTotal(scores) };
            });
            const teamTotal = updatedParticipants.reduce((sum, p) => sum + p.total, 0);
            return { ...team, participants: updatedParticipants, total: teamTotal };
        }).sort((a, b) => b.total - a.total);

        // Calculate individual results
        const allScoresByParticipant: { [participantId: string]: number[] } = {};

        // Collect all scores for each participant
        combinedEntries.individual.forEach(p => {
            const scores = parseScores(p);
            if (!p.participantId) return;
            if (!allScoresByParticipant[p.participantId]) allScoresByParticipant[p.participantId] = [];
            allScoresByParticipant[p.participantId].push(...scores);
        });
        updatedTeams.forEach(team => {
            team.participants.forEach(p => {
                if (!p.participantId) return;
                if (!allScoresByParticipant[p.participantId]) allScoresByParticipant[p.participantId] = [];
                allScoresByParticipant[p.participantId].push(...p.scores);
            });
        });
        
        const individualRanking = Object.entries(allScoresByParticipant)
          .map(([participantId, scores]) => {
              const participantInfo = combinedEventData.participants.find(p => p.id === participantId);
              const sortedScores = [...scores].sort((a, b) => b - a);
              return {
                  participantId,
                  firstName: participantInfo?.firstName || '',
                  lastName: participantInfo?.lastName || '',
                  bestScore: sortedScores[0] || 0,
                  secondBestScore: sortedScores[1] || 0,
                  allScores: scores,
              };
          })
          .sort((a, b) => {
              if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
              return b.secondBestScore - a.secondBestScore;
          })
          .map((p, index) => ({ ...p, rank: index + 1 }));

        setCombinedResults({
            teams: updatedTeams,
            individuals: individualRanking,
        });
        setCombinedEntries({
            ...combinedEntries,
            teams: updatedTeams,
            individual: combinedEntries.individual.map(p => ({ ...p, scores: parseScores(p), total: calculateTotal(parseScores(p)) }))
        });
    }
    setStep(3);
  };


  const getAiSuggestion = async () => {
    setIsAiLoading(true);
    setAiSuggestion("");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const suggestion =
      "Basierend auf der Teilnehmerzahl und der Wettkampfstruktur wird die 'Paarungen'-Methode für einen direkteren und spannenderen Vergleich empfohlen. Die Gesamtwertung ist eine gute Alternative für größere Gruppen oder wenn Einzelleistungen im Vordergrund stehen.";
    setAiSuggestion(suggestion);
    setIsAiLoading(false);
    toast({
      title: "KI-Vorschlag erhalten",
      description: "Die Analyse ist abgeschlossen.",
    });
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    if ((competitionType === 'team' && !teamResults) ||
        (competitionType === 'individual' && !individualResults) ||
        (competitionType === 'combined' && !combinedResults)) {
      toast({ title: "Fehler", description: "Keine Ergebnisdaten zum Exportieren vorhanden.", variant: "destructive" });
      return;
    }

    const exportData = {
        eventName: eventData.eventName,
        competitionType: competitionType!,
        teamResults,
        individualResults,
        combinedResults,
        homeTeamName: competitionType === 'team' ? teamEventData.homeTeamName : undefined,
        visitingTeamName: competitionType === 'team' ? teamEventData.visitingTeamName : undefined,
        allParticipants: competitionType === 'team' ? allTeamParticipants : undefined,
        allIndividualParticipants: competitionType === 'individual' ? individualParticipants : undefined,
        combinedEventData: competitionType === 'combined' ? combinedEventData : undefined,
    };

    if (format === 'pdf') {
        exportToPdf(exportData);
    } else {
        const rows: (string | number)[][] = [];
        rows.push(["Event", eventData.eventName]);
        rows.push([]);

        if (competitionType === 'team' && teamResults) {
            rows.push(["Wettkampftyp", "Team-Wettkampf"]);
            rows.push(["Heimteam", teamEventData.homeTeamName]);
            rows.push(["Gastteam", teamEventData.visitingTeamName]);
            rows.push([]);
            rows.push(["Wertung", "Sieger", "Ergebnis"]);
            rows.push([ "Gesamt", teamResults.totalScoreWinner === "home" ? teamEventData.homeTeamName : teamResults.totalScoreWinner === "visiting" ? teamEventData.visitingTeamName : "Unentschieden", `${teamResults.homeTeamTotal} : ${teamResults.visitingTeamTotal}`]);
            rows.push([ "Paarungen", teamResults.pairingWinner === "home" ? teamEventData.homeTeamName : teamResults.pairingWinner === "visiting" ? teamEventData.visitingTeamName : "Unentschieden", `${teamResults.homePairingScore} : ${teamResults.visitingPairingScore}`]);
            rows.push([]);
            rows.push(["Team", "Vorname", "Nachname", "AK", "Einzelergebnisse", "Gesamt"]);
            allTeamParticipants.forEach((p) => { rows.push([p.team || '', p.firstName, p.lastName, p.isAK ? "Ja" : "Nein", p.scores.join("; "), p.total]); });
        } else if (competitionType === 'individual' && individualResults) {
            rows.push(["Wettkampftyp", "Vereinsmeisterschaft"]);
            rows.push([]);
            rows.push(['Rang', 'Vorname', 'Nachname', 'Bestes Ergebnis', 'Zweitbestes', 'Alle Ergebnisse']);
            individualResults.forEach(p => { rows.push([p.rank, p.firstName, p.lastName, p.bestScore, p.secondBestScore, p.scores.join('; ')]); });
        } else if (competitionType === 'combined' && combinedResults) {
            rows.push(["Wettkampftyp", "Kombinierter Wettkampf"]);
            rows.push([]);
            rows.push(["--- TEAMWERTUNG ---"]);
            rows.push(["Rang", "Team", "Gesamt"]);
            combinedResults.teams.forEach((t, index) => {
                rows.push([index + 1, t.name, t.total]);
                rows.push(["", "Vorname", "Nachname", "Ergebnis"]);
                t.participants.forEach(p => {
                    const info = combinedEventData.participants.find(cp => cp.id === p.participantId);
                    rows.push(["", info?.firstName || '', info?.lastName || '', p.total]);
                });
                rows.push([]);
            });
            rows.push([]);
            rows.push(["--- EINZELWERTUNG ---"]);
            rows.push(['Rang', 'Vorname', 'Nachname', 'Bestes Ergebnis', 'Zweitbestes']);
            combinedResults.individuals.forEach(p => { rows.push([p.rank, p.firstName, p.lastName, p.bestScore, p.secondBestScore]); });
        }
        
        exportToCsv(`${eventData.eventName.replace(/\s+/g, "_")}_Ergebnisse`, rows);
    }
  };

  const resetApp = () => {
    setStep(0);
    setCompetitionType(null);
    setHomeTeamParticipants([]);
    setVisitingTeamParticipants([]);
    setIndividualParticipants([]);
    setCombinedEntries({ individual: [], teams: [] });
    setTeamResults(null);
    setIndividualResults(null);
    setCombinedResults(null);
    setAiSuggestion("");
  };
  
  const renderCompetitionTypeSelection = () => (
    <div className="flex flex-col items-center">
        <Card className="w-full max-w-2xl shadow-lg">
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-center flex items-center justify-center gap-2">
                <Trophy className="text-accent" /> ScoreVault
              </CardTitle>
              <CardDescription className="text-center">
                Wettkampfauswertung leicht gemacht.
                <br />
                Bitte wählen Sie den Wettkampftyp.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 justify-center">
                <Button variant="outline" className="h-24 w-full flex flex-col gap-2" onClick={() => handleCompetitionTypeSelect('team')}>
                    <Users className="h-8 w-8" />
                    <span className="text-lg">Team-Wettkampf</span>
                </Button>
                <Button variant="outline" className="h-24 w-full flex flex-col gap-2" onClick={() => handleCompetitionTypeSelect('individual')}>
                    <User className="h-8 w-8" />
                    <span className="text-lg">Vereinsmeisterschaft</span>
                </Button>
                <Button variant="outline" className="h-24 w-full flex flex-col gap-2" onClick={() => handleCompetitionTypeSelect('combined')}>
                    <Copy className="h-8 w-8" />
                    <span className="text-lg">Kombiniert</span>
                </Button>
            </CardContent>
            <CardFooter>
                <p className="text-xs text-muted-foreground text-center w-full">Wählen Sie 'Team' für Duelle, 'Vereinsmeisterschaft' für Einzelwertungen oder 'Kombiniert' für gemischte Wettkämpfe.</p>
            </CardFooter>
        </Card>
    </div>
  );

  const renderTeamSetupStep = () => (
    <div className="flex flex-col items-center">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center flex items-center justify-center gap-2">
            <Users className="text-accent" /> Team-Wettkampf
          </CardTitle>
          <CardDescription className="text-center">
            Event und Teams für den Mannschafts-Wettkampf konfigurieren.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleTeamSubmit(handleTeamSetupSubmit)}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="eventName">Event-Name</Label>
              <Controller name="eventName" control={teamControl} render={({ field }) => ( <Input id="eventName" placeholder="z.B. Stadtmeisterschaft 2024" {...field} /> )}/>
              {teamErrors.eventName && <p className="text-sm text-destructive">{teamErrors.eventName.message}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="homeTeamName">Heimteam</Label>
                <Controller name="homeTeamName" control={teamControl} render={({ field }) => ( <Input id="homeTeamName" {...field} /> )}/>
                {teamErrors.homeTeamName && <p className="text-sm text-destructive">{teamErrors.homeTeamName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="visitingTeamName">Gastteam</Label>
                 <Controller name="visitingTeamName" control={teamControl} render={({ field }) => ( <Input id="visitingTeamName" {...field} /> )}/>
                {teamErrors.visitingTeamName && <p className="text-sm text-destructive">{teamErrors.visitingTeamName.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="participantsPerTeam">Teilnehmer pro Team</Label>
               <Controller name="participantsPerTeam" control={teamControl} render={({ field }) => (
                   <Select onValueChange={(v) => field.onChange(Number(v))} defaultValue={String(field.value)}>
                    <SelectTrigger id="participantsPerTeam"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (<SelectItem key={num} value={String(num)}>{num} Teilnehmer</SelectItem>))}</SelectContent>
                  </Select>
                )}/>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full">Weiter zur Erfassung <ArrowRight /></Button>
            <Button variant="link" onClick={() => setStep(0)}>Zurück zur Auswahl</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );

  const renderIndividualSetupStep = () => (
    <div className="flex flex-col items-center">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center flex items-center justify-center gap-2">
            <User className="text-accent" /> Vereinsmeisterschaft
          </CardTitle>
          <CardDescription className="text-center">
            Namen des Events für den Einzel-Wettkampf festlegen.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleIndividualSubmit(handleIndividualSetupSubmit)}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="eventName">Event-Name</Label>
              <Controller name="eventName" control={individualControl} render={({ field }) => ( <Input id="eventName" placeholder="z.B. Vereinsmeisterschaft 2024" {...field} /> )}/>
              {individualErrors.eventName && <p className="text-sm text-destructive">{individualErrors.eventName.message}</p>}
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full">Weiter zur Erfassung <ArrowRight /></Button>
            <Button variant="link" onClick={() => setStep(0)}>Zurück zur Auswahl</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );

  const renderCombinedSetupStep = () => (
     <div className="flex flex-col items-center">
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center flex items-center justify-center gap-2">
            <Copy className="text-accent" /> Kombinierter Wettkampf
          </CardTitle>
          <CardDescription className="text-center">
            Legen Sie den Event-Namen fest und verwalten Sie Teilnehmer und Teams.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCombinedSubmit(handleCombinedSetupSubmit)}>
          <CardContent className="space-y-8">
             <div className="space-y-2">
                <Label htmlFor="eventName">Event-Name</Label>
                <Controller name="eventName" control={combinedControl} render={({ field }) => ( <Input id="eventName" placeholder="z.B. Sommerpokal 2024" {...field} /> )}/>
                {combinedErrors.eventName && <p className="text-sm text-destructive">{combinedErrors.eventName.message}</p>}
            </div>

            <Separator />
            
            <div>
              <h3 className="text-lg font-medium mb-4">Teilnehmerliste</h3>
              <div className="space-y-3">
                {combinedParticipantFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-center">
                        <Controller name={`participants.${index}.firstName`} control={combinedControl} render={({ field }) => ( <Input placeholder="Vorname" {...field} /> )}/>
                        <Controller name={`participants.${index}.lastName`} control={combinedControl} render={({ field }) => ( <Input placeholder="Nachname" {...field} /> )}/>
                        <Button variant="ghost" size="icon" onClick={() => removeCombinedParticipant(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => appendCombinedParticipant({ id: crypto.randomUUID(), firstName: '', lastName: '' })}>
                <UserPlus className="mr-2" /> Teilnehmer hinzufügen
              </Button>
            </div>
            
            <Separator />

            <div>
              <h3 className="text-lg font-medium mb-4">Teams</h3>
              <div className="space-y-3">
                 {combinedTeamFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-center">
                        <Controller name={`teams.${index}.name`} control={combinedControl} render={({ field }) => ( <Input placeholder="Team-Name" {...field} /> )}/>
                        <Button variant="ghost" size="icon" onClick={() => removeCombinedTeam(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                 ))}
              </div>
               <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => appendCombinedTeam({ id: crypto.randomUUID(), name: '' })}>
                <Users className="mr-2" /> Team hinzufügen
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full">Weiter zur Erfassung <ArrowRight /></Button>
            <Button variant="link" onClick={() => setStep(0)}>Zurück zur Auswahl</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );

  const renderTeamParticipantEntryStep = () => (
    <div>
        <h1 className="text-3xl font-bold mb-2 text-center">{teamEventData.eventName}</h1>
        <p className="text-muted-foreground text-center mb-8">Teilnehmer und Ergebnisse eintragen</p>
        <div className="grid md:grid-cols-2 gap-8">
            <Card className="shadow-md">
                <CardHeader><CardTitle className="flex items-center gap-2"><Users /> {teamEventData.homeTeamName}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {homeTeamParticipants.map((p, index) => (
                        <div key={p.id}>
                            <p className="font-semibold mb-2">Teilnehmer {p.id}</p>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <Input placeholder="Vorname" value={p.firstName} onChange={(e) => handleParticipantChange(p.id, 'firstName', e.target.value, 'home')} />
                                <Input placeholder="Nachname" value={p.lastName} onChange={(e) => handleParticipantChange(p.id, 'lastName', e.target.value, 'home')} />
                            </div>
                            <Input placeholder="Ergebnisse, getrennt durch Komma" value={p.rawScores} onChange={(e) => handleParticipantChange(p.id, 'rawScores', e.target.value, 'home')} />
                            <div className="flex items-center space-x-2 mt-2">
                                <Checkbox id={`ak-home-${p.id}`} checked={p.isAK} onCheckedChange={(checked) => handleParticipantChange(p.id, 'isAK', !!checked, 'home')} />
                                <Label htmlFor={`ak-home-${p.id}`}>Außer Konkurrenz (AK)</Label>
                            </div>
                            {index < homeTeamParticipants.length - 1 && <Separator className="mt-4" />}
                        </div>
                    ))}
                </CardContent>
            </Card>
             <Card className="shadow-md">
                <CardHeader><CardTitle className="flex items-center gap-2"><Users /> {teamEventData.visitingTeamName}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {visitingTeamParticipants.map((p, index) => (
                        <div key={p.id}>
                            <p className="font-semibold mb-2">Teilnehmer {p.id}</p>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <Input placeholder="Vorname" value={p.firstName} onChange={(e) => handleParticipantChange(p.id, 'firstName', e.target.value, 'visiting')} />
                                <Input placeholder="Nachname" value={p.lastName} onChange={(e) => handleParticipantChange(p.id, 'lastName', e.target.value, 'visiting')} />
                            </div>
                            <Input placeholder="Ergebnisse, getrennt durch Komma" value={p.rawScores} onChange={(e) => handleParticipantChange(p.id, 'rawScores', e.target.value, 'visiting')} />
                            <div className="flex items-center space-x-2 mt-2">
                                <Checkbox id={`ak-visiting-${p.id}`} checked={p.isAK} onCheckedChange={(checked) => handleParticipantChange(p.id, 'isAK', !!checked, 'visiting')} />
                                <Label htmlFor={`ak-visiting-${p.id}`}>Außer Konkurrenz (AK)</Label>
                            </div>
                            {index < visitingTeamParticipants.length - 1 && <Separator className="mt-4" />}
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
        <div className="mt-8 flex justify-center">
            <Button onClick={calculateResults} size="lg">Ergebnisse berechnen <Trophy /></Button>
        </div>
    </div>
  );

  const renderIndividualParticipantEntryStep = () => (
     <div>
        <h1 className="text-3xl font-bold mb-2 text-center">{individualEventData.eventName}</h1>
        <p className="text-muted-foreground text-center mb-8">Teilnehmer und Ergebnisse eintragen</p>
        <Card className="shadow-md max-w-4xl mx-auto">
            <CardHeader><CardTitle className="flex items-center gap-2"><Users /> Teilnehmerliste</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                {individualParticipants.map((p, index) => (
                    <div key={p.id}>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr_auto] gap-2 items-center">
                            <Input placeholder="Vorname" value={p.firstName} onChange={(e) => handleParticipantChange(p.id, 'firstName', e.target.value)} />
                            <Input placeholder="Nachname" value={p.lastName} onChange={(e) => handleParticipantChange(p.id, 'lastName', e.target.value)} />
                            <Input placeholder="Bis zu 10 Ergebnisse, mit Komma getrennt" value={p.rawScores} onChange={(e) => handleParticipantChange(p.id, 'rawScores', e.target.value)} />
                             <Button variant="ghost" size="icon" onClick={() => deleteIndividualParticipant(p.id)} aria-label="Teilnehmer entfernen">
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                        {index < individualParticipants.length - 1 && <Separator className="mt-4" />}
                    </div>
                ))}
                <div className="mt-4 flex justify-center">
                    <Button variant="outline" onClick={addIndividualParticipant}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Teilnehmer hinzufügen
                    </Button>
                </div>
            </CardContent>
        </Card>
        <div className="mt-8 flex justify-center">
            <Button onClick={calculateResults} size="lg">Ergebnisse berechnen <Trophy /></Button>
        </div>
    </div>
  );

  const renderCombinedEntryStep = () => (
    <div>
      <h1 className="text-3xl font-bold mb-2 text-center">{combinedEventData.eventName}</h1>
      <p className="text-muted-foreground text-center mb-8">Teilnehmer zuordnen und Ergebnisse eintragen</p>
      
       <Accordion type="multiple" defaultValue={['teams', 'individuals']} className="w-full max-w-5xl mx-auto space-y-4">
        <AccordionItem value="teams">
            <AccordionTrigger className="text-xl font-semibold">
                <div className="flex items-center gap-2"><Users />Teams</div>
            </AccordionTrigger>
            <AccordionContent>
                {combinedEntries.teams.map((team, teamIndex) => (
                    <Card key={team.id} className="mb-6 shadow-md">
                        <CardHeader>
                            <CardTitle>{team.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {team.participants.map((p, pIndex) => (
                                <div key={pIndex} className="grid grid-cols-[2fr_3fr] gap-4 items-end">
                                    <div className="space-y-2">
                                        <Label>Teilnehmer {pIndex + 1}</Label>
                                        <Select
                                            value={p.participantId}
                                            onValueChange={value => {
                                                const newTeams = [...combinedEntries.teams];
                                                newTeams[teamIndex].participants[pIndex].participantId = value;
                                                setCombinedEntries({ ...combinedEntries, teams: newTeams });
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Teilnehmer auswählen" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {combinedEventData.participants.map(participant => (
                                                    <SelectItem key={participant.id} value={participant.id}>
                                                        {participant.firstName} {participant.lastName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Ergebnisse (für dieses Team)</Label>
                                        <Input 
                                            placeholder="Ergebnisse, getrennt durch Komma" 
                                            value={p.rawScores}
                                            onChange={e => {
                                                const newTeams = [...combinedEntries.teams];
                                                newTeams[teamIndex].participants[pIndex].rawScores = e.target.value;
                                                setCombinedEntries({ ...combinedEntries, teams: newTeams });
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                ))}
            </AccordionContent>
        </AccordionItem>

        <AccordionItem value="individuals">
            <AccordionTrigger className="text-xl font-semibold">
                <div className="flex items-center gap-2"><User />Einzelstarter</div>
            </AccordionTrigger>
            <AccordionContent>
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle>Zusätzliche Einzelstarts</CardTitle>
                        <CardDescription>Hier können Teilnehmer erfasst werden, die nur in der Einzelwertung antreten, oder Teilnehmer aus Teams, die einen zusätzlichen, separaten Einzelstart haben.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {combinedEntries.individual.map((p, pIndex) => (
                            <div key={pIndex} className="grid grid-cols-[2fr_3fr_auto] gap-4 items-end">
                                <div className="space-y-2">
                                    <Label>Teilnehmer</Label>
                                    <Select
                                        value={p.participantId}
                                        onValueChange={value => {
                                            const newIndividuals = [...combinedEntries.individual];
                                            newIndividuals[pIndex].participantId = value;
                                            setCombinedEntries({ ...combinedEntries, individual: newIndividuals });
                                        }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Teilnehmer auswählen" /></SelectTrigger>
                                        <SelectContent>
                                            {combinedEventData.participants.map(participant => (
                                                <SelectItem key={participant.id} value={participant.id}>
                                                    {participant.firstName} {participant.lastName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Ergebnisse (für Einzelwertung)</Label>
                                    <Input 
                                        placeholder="Ergebnisse, getrennt durch Komma"
                                        value={p.rawScores}
                                        onChange={e => {
                                            const newIndividuals = [...combinedEntries.individual];
                                            newIndividuals[pIndex].rawScores = e.target.value;
                                            setCombinedEntries({ ...combinedEntries, individual: newIndividuals });
                                        }}
                                    />
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setCombinedEntries(prev => ({...prev, individual: prev.individual.filter((_, i) => i !== pIndex)}))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                        ))}
                        <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => {
                                setCombinedEntries(prev => ({
                                    ...prev,
                                    individual: [...prev.individual, { participantId: '', scores: [], rawScores: "", total: 0 }]
                                }))
                            }}
                        >
                            <PlusCircle className="mr-2" /> Einzelstart hinzufügen
                        </Button>
                    </CardContent>
                </Card>
            </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="mt-8 flex justify-center">
          <Button onClick={calculateResults} size="lg">Ergebnisse berechnen <Trophy /></Button>
      </div>
    </div>
  );

  const renderResultsStep = () => {
    if ((competitionType === 'team' && !teamResults) ||
        (competitionType === 'individual' && !individualResults) ||
        (competitionType === 'combined' && !combinedResults)) return null;


    const getWinnerName = (winner: "home" | "visiting" | "draw", home: string, visiting: string) => {
        if (winner === 'home') return home;
        if (winner === 'visiting') return visiting;
        return "Unentschieden";
    }

    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">{eventData.eventName}</h1>
          {competitionType === 'team' && <p className="text-xl text-muted-foreground">{teamEventData.homeTeamName} vs. {teamEventData.visitingTeamName}</p>}
        </div>

        {competitionType === 'team' && teamResults && (
            <Card className="shadow-lg">
              <CardHeader><CardTitle>Endergebnis Team-Wettkampf</CardTitle></CardHeader>
              <CardContent>
                <Alert className="mb-6 bg-primary/10 border-primary/20">
                  <Trophy className="h-4 w-4 text-primary" />
                  <AlertTitle>Gewinner nach {scoringMethod === 'total' ? 'Gesamtringen' : 'Paarungen'}: {getWinnerName(scoringMethod === 'total' ? teamResults.totalScoreWinner : teamResults.pairingWinner, teamEventData.homeTeamName, teamEventData.visitingTeamName)}</AlertTitle>
                  <AlertDescription>
                    {scoringMethod === 'total'
                      ? `${teamEventData.homeTeamName}: ${teamResults.homeTeamTotal} Ringe | ${teamEventData.visitingTeamName}: ${teamResults.visitingTeamTotal} Ringe`
                      : `${teamEventData.homeTeamName}: ${teamResults.homePairingScore} Punkte | ${teamEventData.visitingTeamName}: ${teamResults.visitingPairingScore} Punkte`}
                  </AlertDescription>
                </Alert>
                <Tabs value={scoringMethod} onValueChange={(value) => setScoringMethod(value as 'total' | 'pairs')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="total"><Users className="mr-2" />Gesamt Ringe</TabsTrigger>
                    <TabsTrigger value="pairs"><Swords className="mr-2" />Paarungen</TabsTrigger>
                  </TabsList>
                  <TabsContent value="total" className="mt-4">
                     <Table>
                        <TableHeader><TableRow><TableHead>Teilnehmer</TableHead><TableHead>Team</TableHead><TableHead>AK</TableHead><TableHead className="text-right">Gesamt</TableHead></TableRow></TableHeader>
                        <TableBody>{allTeamParticipants.sort((a,b) => b.total - a.total).map(p => (<TableRow key={`${p.team}-${p.id}`} className={cn(p.isAK && "text-muted-foreground italic")}><TableCell>{p.firstName} {p.lastName}</TableCell><TableCell>{p.team}</TableCell><TableCell>{p.isAK ? 'Ja' : 'Nein'}</TableCell><TableCell className="text-right font-medium">{p.total}</TableCell></TableRow>))}</TableBody>
                      </Table>
                  </TabsContent>
                  <TabsContent value="pairs" className="mt-4">
                    <Table>
                        <TableHeader><TableRow><TableHead>{teamEventData.homeTeamName}</TableHead><TableHead className="text-center">Ergebnis</TableHead><TableHead className="text-right">{teamEventData.visitingTeamName}</TableHead></TableRow></TableHeader>
                        <TableBody>{teamResults.pairingResults.map((pair, index) => (<TableRow key={index}><TableCell>{pair.homeParticipant.firstName} {pair.homeParticipant.lastName}</TableCell><TableCell className="text-center font-bold"><span className={cn(pair.winner === 'home' && 'text-primary')}>{pair.homeParticipant.total}</span> : <span className={cn(pair.winner === 'visiting' && 'text-primary')}>{pair.visitingParticipant.total}</span></TableCell><TableCell className="text-right">{pair.visitingParticipant.firstName} {pair.visitingParticipant.lastName}</TableCell></TableRow>))}</TableBody>
                      </Table>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
        )}

        {competitionType === 'individual' && individualResults && (
            <Card className="shadow-lg">
                <CardHeader><CardTitle>Ergebnis Vereinsmeisterschaft</CardTitle></CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader><TableRow><TableHead>Rang</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Bestes Ergebnis</TableHead><TableHead className="text-right">Zweitbestes</TableHead></TableRow></TableHeader>
                        <TableBody>{individualResults.map(p => (<TableRow key={p.id}><TableCell className="font-bold">{p.rank}</TableCell><TableCell>{p.firstName} {p.lastName}</TableCell><TableCell className="text-right font-medium">{p.bestScore}</TableCell><TableCell className="text-right">{p.secondBestScore}</TableCell></TableRow>))}</TableBody>
                    </Table>
                </CardContent>
            </Card>
        )}

        {competitionType === 'combined' && combinedResults && (
            <div className="space-y-6">
                <Card className="shadow-lg">
                    <CardHeader><CardTitle>Team-Wertung</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Rang</TableHead><TableHead>Team</TableHead><TableHead className="text-right">Gesamt</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {combinedResults.teams.map((team, index) => (
                                    <React.Fragment key={team.id}>
                                        <TableRow className="bg-muted/50">
                                            <TableCell className="font-bold">{index + 1}</TableCell>
                                            <TableCell className="font-semibold">{team.name}</TableCell>
                                            <TableCell className="text-right font-bold">{team.total}</TableCell>
                                        </TableRow>
                                        {team.participants.map((p, pIndex) => {
                                            const info = combinedEventData.participants.find(cp => cp.id === p.participantId);
                                            return (
                                                <TableRow key={pIndex} className="text-sm">
                                                    <TableCell></TableCell>
                                                    <TableCell className="pl-8">{info?.firstName} {info?.lastName}</TableCell>
                                                    <TableCell className="text-right">{p.total}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </React.Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                <Card className="shadow-lg">
                    <CardHeader><CardTitle>Einzel-Wertung</CardTitle><CardDescription>Bestes Ergebnis aus allen Starts</CardDescription></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Rang</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Bestes Ergebnis</TableHead><TableHead className="text-right">Zweitbestes</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {combinedResults.individuals.map(p => (
                                    <TableRow key={p.participantId}>
                                        <TableCell className="font-bold">{p.rank}</TableCell>
                                        <TableCell>{p.firstName} {p.lastName}</TableCell>
                                        <TableCell className="text-right font-medium">{p.bestScore}</TableCell>
                                        <TableCell className="text-right">{p.secondBestScore}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        )}

        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Analyse & Aktionen</CardTitle>
                <CardDescription>Nutzen Sie KI für Einblicke oder exportieren Sie die Ergebnisse.</CardDescription>
            </CardHeader>
            <CardContent>
                {aiSuggestion && competitionType === 'team' && (
                    <Alert variant="default" className="mb-4 bg-accent/10 border-accent/20">
                        <BrainCircuit className="h-4 w-4 text-accent" />
                        <AlertTitle className="text-accent">KI-Vorschlag</AlertTitle>
                        <AlertDescription>{aiSuggestion}</AlertDescription>
                    </Alert>
                )}
                <div className="flex flex-wrap gap-4">
                    {competitionType === 'team' && (
                      <Button onClick={getAiSuggestion} disabled={isAiLoading}>
                          {isAiLoading ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
                          {isAiLoading ? "Analysiere..." : "KI-Vorschlag für Wertung"}
                      </Button>
                    )}
                    <Button onClick={() => setStep(2)} variant="secondary">
                        <Pencil />
                        Ergebnisse bearbeiten
                    </Button>
                     <Button onClick={() => setStep(1)} variant="secondary">
                        <Settings />
                        Setup bearbeiten
                    </Button>
                    <Button onClick={() => handleExport('csv')} variant="secondary">
                        <FileDown />
                        Als CSV exportieren
                    </Button>
                    <Button onClick={() => handleExport('pdf')} variant="secondary">
                        <FileText />
                        Als PDF exportieren
                    </Button>
                    <Button onClick={resetApp} variant="outline">
                        <RotateCcw />
                        Neuen Wettkampf starten
                    </Button>
                </div>
            </CardContent>
        </Card>

      </div>
    )
  };

  const renderActiveStep = () => {
    switch (step) {
      case 0: return renderCompetitionTypeSelection();
      case 1:
        if (competitionType === 'team') return renderTeamSetupStep();
        if (competitionType === 'individual') return renderIndividualSetupStep();
        if (competitionType === 'combined') return renderCombinedSetupStep();
        return null;
      case 2:
        if (competitionType === 'team') return renderTeamParticipantEntryStep();
        if (competitionType === 'individual') return renderIndividualParticipantEntryStep();
        if (competitionType === 'combined') return renderCombinedEntryStep();
        return null;
      case 3: return renderResultsStep();
      default: return renderCompetitionTypeSelection();
    }
  }

  return (
    <div className="w-full">
      {renderActiveStep()}
    </div>
  );
}
