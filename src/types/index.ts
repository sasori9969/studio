export type Participant = {
  id: number;
  firstName: string;
  lastName: string;
  scores: number[];
  rawScores?: string; // To hold the comma-separated string from input
  total: number;
  isAK: boolean;
};

export type PairingResult = {
  homeParticipant: Participant;
  visitingParticipant: Participant;
  winner: "home" | "visiting" | "draw";
};

export type Results = {
  homeTeamTotal: number;
  visitingTeamTotal: number;
  totalScoreWinner: "home" | "visiting" | "draw";
  pairingResults: PairingResult[];
  homePairingScore: number;
  visitingPairingScore: number;
  pairingWinner: "home" | "visiting" | "draw";
};
