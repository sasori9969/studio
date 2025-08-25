import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TeamResults, RankedParticipant, Participant, CombinedResults, CombinedSetupFormData } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function exportToCsv(filename: string, rows: (string | number)[][]) {
  if (typeof window === "undefined") return;
  
  const csvContent = "data:text/csv;charset=utf-8," 
    + rows.map(e => e.join(",")).join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

interface ExportPdfParams {
  eventName: string;
  competitionType: 'team' | 'individual' | 'combined';
  teamResults?: TeamResults | null;
  individualResults?: RankedParticipant[] | null;
  combinedResults?: CombinedResults | null;
  homeTeamName?: string;
  visitingTeamName?: string;
  allParticipants?: Participant[];
  allIndividualParticipants?: Participant[];
  combinedEventData?: CombinedSetupFormData;
}

export function exportToPdf({
  eventName,
  competitionType,
  teamResults,
  individualResults,
  combinedResults,
  homeTeamName,
  visitingTeamName,
  allParticipants,
  allIndividualParticipants,
  combinedEventData
}: ExportPdfParams) {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(eventName, 14, 22);

  if (competitionType === 'team' && teamResults && homeTeamName && visitingTeamName && allParticipants) {
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Team-Wettkampf: ${homeTeamName} vs. ${visitingTeamName}`, 14, 30);
    
    autoTable(doc, {
      startY: 35,
      head: [['Wertung', 'Sieger', 'Ergebnis']],
      body: [
        ['Gesamtringe', teamResults.totalScoreWinner === 'home' ? homeTeamName : teamResults.totalScoreWinner === 'visiting' ? visitingTeamName : 'Unentschieden', `${teamResults.homeTeamTotal} : ${teamResults.visitingTeamTotal}`],
        ['Paarungen', teamResults.pairingWinner === 'home' ? homeTeamName : teamResults.pairingWinner === 'visiting' ? visitingTeamName : 'Unentschieden', `${teamResults.homePairingScore} : ${teamResults.visitingPairingScore}`],
      ],
      theme: 'striped',
    });

    const participantData = allParticipants.map(p => [
      p.team || '',
      p.firstName,
      p.lastName,
      p.isAK ? "Ja" : "Nein",
      p.scores.join('; '),
      p.total,
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Team', 'Vorname', 'Nachname', 'AK', 'Einzelergebnisse', 'Gesamt']],
      body: participantData,
      theme: 'grid',
    });
  }

  if (competitionType === 'individual' && individualResults) {
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text("Einzelwettkampf: Vereinsmeisterschaft", 14, 30);
    
    const individualData = individualResults.map(p => [
        p.rank,
        p.firstName,
        p.lastName,
        p.bestScore,
        p.secondBestScore,
        p.scores.join('; ')
    ]);
    
    autoTable(doc, {
        startY: 35,
        head: [['Rang', 'Vorname', 'Nachname', 'Bestes Ergebnis', 'Zweitbestes', 'Alle Ergebnisse']],
        body: individualData,
        theme: 'grid',
    });
  }

  if (competitionType === 'combined' && combinedResults && combinedEventData) {
    doc.setFontSize(12);
    doc.text("Kombinierter Wettkampf - Teamwertung", 14, 30);
    
    const teamBody: any[] = [];
    combinedResults.teams.forEach((team, index) => {
        teamBody.push([{ content: `${index + 1}. ${team.name}`, colSpan: 2, styles: { fontStyle: 'bold' } }, { content: team.total, styles: { halign: 'right', fontStyle: 'bold' } } ]);
        team.participants.forEach(p => {
             const info = combinedEventData.participants.find(cp => cp.id === p.participantId);
             teamBody.push(['', `${info?.firstName} ${info?.lastName}`, { content: p.total, styles: { halign: 'right' }}]);
        });
    });

    autoTable(doc, {
        startY: 35,
        head: [['Rang/Team', 'Teilnehmer', 'Ergebnis']],
        body: teamBody,
        theme: 'striped',
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['Rang', 'Name', 'Bestes Ergebnis', 'Zweitbestes']],
      body: combinedResults.individuals.map(p => [p.rank, `${p.firstName} ${p.lastName}`, p.bestScore, p.secondBestScore]),
      theme: 'grid',
      didDrawPage: (data) => {
        doc.setFontSize(12);
        doc.text("Kombinierter Wettkampf - Einzelwertung", 14, data.cursor?.y ? data.cursor.y - 10 : 30);
      }
    });
  }

  doc.save(`${eventName.replace(/\s+/g, "_")}_Ergebnisse.pdf`);
}
