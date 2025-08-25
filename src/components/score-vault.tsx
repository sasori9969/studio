"use client";

import { useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { exportToCsv } from "@/lib/utils";
import type { Participant, Results, PairingResult } from "@/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const setupSchema = z.object({
  eventName: z.string().min(1, "Event-Name ist erforderlich."),
  homeTeamName: z.string().min(1, "Name des Heimteams ist erforderlich."),
  visitingTeamName: z.string().min(1, "Name des Gastteams ist erforderlich."),
  participantsPerTeam: z.number().min(1).max(20),
});

type SetupFormData = z.infer<typeof setupSchema>;

export default function ScoreVault() {
  const [step, setStep] = useState(1);
  const { toast } = useToast();

  // Step 1 State
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      eventName: "",
      homeTeamName: "Heimteam",
      visitingTeamName: "Gastteam",
      participantsPerTeam: 3,
    },
  });
  const eventData = watch();

  // Step 2 State
  const [homeTeamParticipants, setHomeTeamParticipants] = useState<
    Participant[]
  >([]);
  const [visitingTeamParticipants, setVisitingTeamParticipants] = useState<
    Participant[]
  >([]);

  // Step 3 State
  const [results, setResults] = useState<Results | null>(null);
  const [scoringMethod, setScoringMethod] = useState<"total" | "pairs">(
    "total"
  );
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const allParticipants = useMemo(() => [
    ...homeTeamParticipants.map(p => ({...p, team: eventData.homeTeamName})),
    ...visitingTeamParticipants.map(p => ({...p, team: eventData.visitingTeamName}))
  ], [homeTeamParticipants, visitingTeamParticipants, eventData]);

  const handleSetupSubmit = (data: SetupFormData) => {
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

  const handleParticipantChange = (
    team: "home" | "visiting",
    id: number,
    field: keyof Participant,
    value: string | boolean
  ) => {
    const updater = (prev: Participant[]) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p));
    if (team === "home") {
      setHomeTeamParticipants(updater);
    } else {
      setVisitingTeamParticipants(updater);
    }
  };

  const calculateResults = () => {
    const parseScores = (p: Participant) => ({
        ...p,
        scores: (p.rawScores || "").split(/[,;\s]+/).filter(s => s.trim() !== '').map(Number).filter(n => !isNaN(n))
    });

    const calculateTotal = (p: Participant) => ({
        ...p,
        total: p.scores.reduce((a, b) => a + b, 0)
    });

    const updatedHomeTeam = homeTeamParticipants.map(parseScores).map(calculateTotal);
    const updatedVisitingTeam = visitingTeamParticipants.map(parseScores).map(calculateTotal);

    setHomeTeamParticipants(updatedHomeTeam);
    setVisitingTeamParticipants(updatedVisitingTeam);

    const competingHome = updatedHomeTeam.filter((p) => !p.isAK);
    const competingVisiting = updatedVisitingTeam.filter((p) => !p.isAK);

    const homeTeamTotal = competingHome.reduce((sum, p) => sum + p.total, 0);
    const visitingTeamTotal = competingVisiting.reduce(
      (sum, p) => sum + p.total,
      0
    );

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
      if (homeP.total > visitingP.total) {
        winner = "home";
        homePairingScore++;
      } else if (visitingP.total > homeP.total) {
        winner = "visiting";
        visitingPairingScore++;
      }
      pairingResults.push({
        homeParticipant: homeP,
        visitingParticipant: visitingP,
        winner,
      });
    }

    let pairingWinner: "home" | "visiting" | "draw" = "draw";
    if (homePairingScore > visitingPairingScore) pairingWinner = "home";
    else if (visitingPairingScore > homePairingScore)
      pairingWinner = "visiting";

    setResults({
      homeTeamTotal,
      visitingTeamTotal,
      totalScoreWinner,
      pairingResults,
      homePairingScore,
      visitingPairingScore,
      pairingWinner,
    });

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

  const handleExport = () => {
    if (!results) return;
    const rows: (string | number)[][] = [];
    rows.push(["Event", eventData.eventName]);
    rows.push(["Heimteam", eventData.homeTeamName]);
    rows.push(["Gastteam", eventData.visitingTeamName]);
    rows.push([]);
    rows.push([
      "Sieger (Gesamt)",
      results.totalScoreWinner === "home"
        ? eventData.homeTeamName
        : results.totalScoreWinner === "visiting"
        ? eventData.visitingTeamName
        : "Unentschieden",
      `${results.homeTeamTotal} : ${results.visitingTeamTotal}`,
    ]);
    rows.push([
      "Sieger (Paarungen)",
      results.pairingWinner === "home"
        ? eventData.homeTeamName
        : results.pairingWinner === "visiting"
        ? eventData.visitingTeamName
        : "Unentschieden",
      `${results.homePairingScore} : ${results.visitingPairingScore}`,
    ]);
    rows.push([]);
    rows.push([
      "Team",
      "Vorname",
      "Nachname",
      "AK",
      "Einzelergebnisse",
      "Gesamt",
    ]);

    const allParticipantsForExport = [
      ...homeTeamParticipants.map((p) => ({ ...p, team: eventData.homeTeamName })),
      ...visitingTeamParticipants.map((p) => ({ ...p, team: eventData.visitingTeamName })),
    ];

    allParticipantsForExport.forEach((p) => {
      rows.push([
        p.team,
        p.firstName,
        p.lastName,
        p.isAK ? "Ja" : "Nein",
        p.scores.join("; "),
        p.total,
      ]);
    });
    
    exportToCsv(
      `${eventData.eventName.replace(/\s+/g, "_")}_Ergebnisse`,
      rows
    );
  };

  const resetApp = () => {
    setStep(1);
    setResults(null);
    setAiSuggestion("");
  };

  const renderSetupStep = () => (
    <div className="flex flex-col items-center">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center flex items-center justify-center gap-2">
            <Trophy className="text-accent" /> ScoreVault
          </CardTitle>
          <CardDescription className="text-center">
            Wettkampfauswertung leicht gemacht.
            <br />
            Event und Teams einrichten.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(handleSetupSubmit)}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="eventName">Event-Name</Label>
              <Controller
                name="eventName"
                control={control}
                render={({ field }) => (
                  <Input id="eventName" placeholder="z.B. Stadtmeisterschaft 2024" {...field} />
                )}
              />
              {errors.eventName && <p className="text-sm text-destructive">{errors.eventName.message}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="homeTeamName">Heimteam</Label>
                <Controller
                  name="homeTeamName"
                  control={control}
                  render={({ field }) => (
                    <Input id="homeTeamName" {...field} />
                  )}
                />
                {errors.homeTeamName && <p className="text-sm text-destructive">{errors.homeTeamName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="visitingTeamName">Gastteam</Label>
                 <Controller
                  name="visitingTeamName"
                  control={control}
                  render={({ field }) => (
                    <Input id="visitingTeamName" {...field} />
                  )}
                />
                {errors.visitingTeamName && <p className="text-sm text-destructive">{errors.visitingTeamName.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="participantsPerTeam">Teilnehmer pro Team</Label>
               <Controller
                name="participantsPerTeam"
                control={control}
                render={({ field }) => (
                   <Select onValueChange={(v) => field.onChange(Number(v))} defaultValue={String(field.value)}>
                    <SelectTrigger id="participantsPerTeam">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(
                        (num) => (
                          <SelectItem key={num} value={String(num)}>
                            {num} Teilnehmer
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              Weiter zur Erfassung <ArrowRight />
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );

  const renderParticipantEntryStep = () => (
    <div>
        <h1 className="text-3xl font-bold mb-2 text-center">{eventData.eventName}</h1>
        <p className="text-muted-foreground text-center mb-8">Teilnehmer und Ergebnisse eintragen</p>
        <div className="grid md:grid-cols-2 gap-8">
            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users /> {eventData.homeTeamName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {homeTeamParticipants.map((p, index) => (
                        <div key={p.id}>
                            <p className="font-semibold mb-2">Teilnehmer {p.id}</p>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <Input placeholder="Vorname" value={p.firstName} onChange={(e) => handleParticipantChange('home', p.id, 'firstName', e.target.value)} />
                                <Input placeholder="Nachname" value={p.lastName} onChange={(e) => handleParticipantChange('home', p.id, 'lastName', e.target.value)} />
                            </div>
                            <Input placeholder="Ergebnisse, getrennt durch Komma" value={p.rawScores} onChange={(e) => handleParticipantChange('home', p.id, 'rawScores', e.target.value)} />
                            <div className="flex items-center space-x-2 mt-2">
                                <Checkbox id={`ak-home-${p.id}`} checked={p.isAK} onCheckedChange={(checked) => handleParticipantChange('home', p.id, 'isAK', !!checked)} />
                                <Label htmlFor={`ak-home-${p.id}`}>Außer Konkurrenz (AK)</Label>
                            </div>
                            {index < homeTeamParticipants.length - 1 && <Separator className="mt-4" />}
                        </div>
                    ))}
                </CardContent>
            </Card>
             <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users /> {eventData.visitingTeamName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {visitingTeamParticipants.map((p, index) => (
                        <div key={p.id}>
                            <p className="font-semibold mb-2">Teilnehmer {p.id}</p>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <Input placeholder="Vorname" value={p.firstName} onChange={(e) => handleParticipantChange('visiting', p.id, 'firstName', e.target.value)} />
                                <Input placeholder="Nachname" value={p.lastName} onChange={(e) => handleParticipantChange('visiting', p.id, 'lastName', e.target.value)} />
                            </div>
                            <Input placeholder="Ergebnisse, getrennt durch Komma" value={p.rawScores} onChange={(e) => handleParticipantChange('visiting', p.id, 'rawScores', e.target.value)} />
                            <div className="flex items-center space-x-2 mt-2">
                                <Checkbox id={`ak-visiting-${p.id}`} checked={p.isAK} onCheckedChange={(checked) => handleParticipantChange('visiting', p.id, 'isAK', !!checked)} />
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

  const renderResultsStep = () => {
    if (!results) return null;

    const winnerByTotal = results.totalScoreWinner === 'home' ? eventData.homeTeamName : results.totalScoreWinner === 'visiting' ? eventData.visitingTeamName : 'Unentschieden';
    const winnerByPairs = results.pairingWinner === 'home' ? eventData.homeTeamName : results.pairingWinner === 'visiting' ? eventData.visitingTeamName : 'Unentschieden';
    
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">{eventData.eventName}</h1>
          <p className="text-xl text-muted-foreground">{eventData.homeTeamName} vs. {eventData.visitingTeamName}</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Endergebnis</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="mb-6 bg-primary/10 border-primary/20">
              <Trophy className="h-4 w-4 text-primary" />
              <AlertTitle>
                Gewinner nach {scoringMethod === 'total' ? 'Gesamtringen' : 'Paarungen'}: {scoringMethod === 'total' ? winnerByTotal : winnerByPairs}
              </AlertTitle>
              <AlertDescription>
                {scoringMethod === 'total'
                  ? `${eventData.homeTeamName}: ${results.homeTeamTotal} Ringe | ${eventData.visitingTeamName}: ${results.visitingTeamTotal} Ringe`
                  : `${eventData.homeTeamName}: ${results.homePairingScore} Punkte | ${eventData.visitingTeamName}: ${results.visitingPairingScore} Punkte`}
              </AlertDescription>
            </Alert>
            
            <Tabs value={scoringMethod} onValueChange={(value) => setScoringMethod(value as 'total' | 'pairs')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="total"><Users className="mr-2" />Gesamt Ringe</TabsTrigger>
                <TabsTrigger value="pairs"><Swords className="mr-2" />Paarungen</TabsTrigger>
              </TabsList>
              <TabsContent value="total" className="mt-4">
                 <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teilnehmer</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>AK</TableHead>
                        <TableHead className="text-right">Gesamt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allParticipants.sort((a,b) => b.total - a.total).map(p => (
                        <TableRow key={`${p.team}-${p.id}`} className={cn(p.isAK && "text-muted-foreground italic")}>
                          <TableCell>{p.firstName} {p.lastName}</TableCell>
                          <TableCell>{p.team}</TableCell>
                          <TableCell>{p.isAK ? 'Ja' : 'Nein'}</TableCell>
                          <TableCell className="text-right font-medium">{p.total}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
              </TabsContent>
              <TabsContent value="pairs" className="mt-4">
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{eventData.homeTeamName}</TableHead>
                        <TableHead className="text-center">Ergebnis</TableHead>
                        <TableHead className="text-right">{eventData.visitingTeamName}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.pairingResults.map((pair, index) => (
                        <TableRow key={index}>
                           <TableCell>{pair.homeParticipant.firstName} {pair.homeParticipant.lastName}</TableCell>
                           <TableCell className="text-center font-bold">
                                <span className={cn(pair.winner === 'home' && 'text-primary')}>{pair.homeParticipant.total}</span>
                                 : 
                                <span className={cn(pair.winner === 'visiting' && 'text-primary')}>{pair.visitingParticipant.total}</span>
                           </TableCell>
                           <TableCell className="text-right">{pair.visitingParticipant.firstName} {pair.visitingParticipant.lastName}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>KI-Analyse & Aktionen</CardTitle>
                <CardDescription>Nutzen Sie KI für Einblicke oder exportieren Sie die Ergebnisse.</CardDescription>
            </CardHeader>
            <CardContent>
                {aiSuggestion && (
                    <Alert variant="default" className="mb-4 bg-accent/10 border-accent/20">
                        <BrainCircuit className="h-4 w-4 text-accent" />
                        <AlertTitle className="text-accent">KI-Vorschlag</AlertTitle>
                        <AlertDescription>{aiSuggestion}</AlertDescription>
                    </Alert>
                )}
                <div className="flex flex-wrap gap-4">
                    <Button onClick={getAiSuggestion} disabled={isAiLoading}>
                        {isAiLoading ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
                        {isAiLoading ? "Analysiere..." : "KI-Vorschlag für Wertung"}
                    </Button>
                    <Button onClick={() => setStep(2)} variant="secondary">
                        <Pencil />
                        Daten bearbeiten
                    </Button>
                    <Button onClick={handleExport} variant="secondary">
                        <FileDown />
                        Als CSV exportieren
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

  return (
    <div className="w-full">
      {step === 1 && renderSetupStep()}
      {step === 2 && renderParticipantEntryStep()}
      {step === 3 && renderResultsStep()}
    </div>
  );
}

    