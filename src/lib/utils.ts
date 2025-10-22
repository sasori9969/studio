import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TeamResults, RankedParticipant, Participant, CombinedResults, CombinedSetupFormData } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs))
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
  
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(18);
  doc.text(eventName, pageWidth / 2, 22, { align: 'center' });
  
  if (competitionType === 'team' && teamResults && homeTeamName && visitingTeamName && allParticipants) {
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Rundenkampf: ${homeTeamName} vs. ${visitingTeamName}`, 14, 30);
    
    autoTable(doc, {
      startY: 35,
      head: [['Wertung', 'Sieger', 'Ergebnis']],
      body: [
        ['Gesamtringe', teamResults.totalScoreWinner === 'home' ? homeTeamName : teamResults.totalScoreWinner === 'visiting' ? visitingTeamName : 'Unentschieden', `${teamResults.homeTeamTotal} : ${teamResults.visitingTeamTotal}`],
        ['Paarungen', teamResults.pairingWinner === 'home' ? homeTeamName : teamResults.pairingWinner === 'visiting' ? visitingTeamName : 'Unentschieden', `${teamResults.homePairingScore} : ${teamResults.visitingPairingScore}`],
      ],
      theme: 'striped',
    });

    const pairingBody = teamResults.pairingResults.map((p, index) => [
      `${homeTeamName} ${index + 1}`,
      `${p.homeParticipant.firstName} ${p.homeParticipant.lastName}`,
      p.homeParticipant.total,
      p.visitingParticipant.total,
      `${p.visitingParticipant.firstName} ${p.visitingParticipant.lastName}`,
      `${visitingTeamName} ${index + 1}`,
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Heim', 'Schütze', 'Erg.', 'Erg.', 'Schütze', 'Gast']],
      body: pairingBody,
      theme: 'grid',
      headStyles: { halign: 'center' },
      columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' } },
    });


    const participantData = allParticipants.sort((a, b) => (a.isAK ? 1 : 0) - (b.isAK ? 1 : 0) || a.id - b.id).map(p => [
      p.team || '',
      p.firstName,
      p.lastName,
      p.isAK ? "Ja" : "Nein",
      p.scores.join('; '),
      p.total,
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['Team', 'Vorname', 'Nachname', 'AK', 'Einzelergebnisse', 'Gesamt']],
      body: participantData,
      columnStyles: { 5: { halign: 'center' } },
      theme: 'grid',
    });
  }

  if (competitionType === 'individual' && individualResults) {
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text("Einzelwettbewerb", 14, 30);
    
    const individualData = individualResults.map(p => {
      const allScores = [...p.scores].sort((a, b) => b - a);
      const scoresToDisplay: (number | string)[] = allScores.slice(0, 10);
      while (scoresToDisplay.length < 10) {
        scoresToDisplay.push('');
      }
      return [
        p.rank,
        p.firstName,
        p.lastName,
        ...scoresToDisplay
      ];
    });
    
    autoTable(doc, {
        startY: 35,
        head: [['Rang', 'Vorname', 'Nachname', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']],
        body: individualData,
        columnStyles: {
            0: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'center' },
            6: { halign: 'center' },
            7: { halign: 'center' },
            8: { halign: 'center' },
            9: { halign: 'center' },
            10: { halign: 'center' },
            11: { halign: 'center' },
        },
        theme: 'grid',
    });
  }

  if (competitionType === 'combined' && combinedResults && combinedEventData) {
    doc.setFontSize(12);
    doc.text("Vereinsmeisterschaft - Teamwertung", 14, 30);
    
    const teamBody: any[] = [];
    combinedResults.teams.forEach((team, index) => {
        teamBody.push([{ content: `${index + 1}. ${team.name}`, colSpan: 2, styles: { fontStyle: 'bold' } }, { content: team.total, styles: { halign: 'center', fontStyle: 'bold' } } ]);
        team.participants.forEach(p => {
             const info = combinedEventData.participants.find(cp => cp.id === p.participantId);
             teamBody.push(['', `${info?.firstName} ${info?.lastName}`, { content: p.total, styles: { halign: 'center' }}]);
        });
    });

    autoTable(doc, {
        startY: 35,
        head: [['Rang/Team', 'Teilnehmer', 'Ergebnis']],
        body: teamBody,
        theme: 'striped',
    });

    const individualTableStartY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.text("Vereinsmeisterschaft - Einzelwertung", 14, individualTableStartY - 5);
    
    autoTable(doc, {
      startY: individualTableStartY,
      head: [['Rang', 'Name', 'Bestes Ergebnis', 'Zweitbestes']],
      body: combinedResults.individuals.map(p => [p.rank, `${p.firstName} ${p.lastName}`, p.bestScore, p.secondBestScore]),
      columnStyles: {
          0: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' },
      },
      theme: 'grid',
    });
  }

  doc.save(`${eventName.replace(/\s+/g, "_")}_Ergebnisse.pdf`);
}
