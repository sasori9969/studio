export type Participant = {
  id: number;
  firstName: string;
  lastName: string;
  scores: number[];
  rawScores?: string; // To hold the comma-separated string from input
  total: number;
  isAK: boolean;
  team?: string;
};

export type RankedParticipant = Participant & {
  rank: number;
  bestScore: number;
  secondBestScore: number;
};

export type PairingResult = {
  homeParticipant: Participant;
  visitingParticipant: Participant;
  winner: "home" | "visiting" | "draw";
};

export type TeamResults = {
  homeTeamTotal: number;
  visitingTeamTotal: number;
  totalScoreWinner: "home" | "visiting" | "draw";
  pairingResults: PairingResult[];
  homePairingScore: number;
  visitingPairingScore: number;
  pairingWinner: "home" | "visiting" | "draw";
};

export type CompetitionType = "team" | "individual";
