export type Participant = {
  id: number;
  firstName: string;
  lastName: string;
  scores: number[]; 
  rawScores: string; // To hold the comma-separated string from input
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

// --- Combined Competition Types ---

export type CombinedParticipant = {
  participantId: string; // references a participant from the main list
  scores: number[];
  rawScores: string;
  total: number;
};

export type CombinedTeam = {
  id: string; // id from setup
  name: string;
  participants: CombinedParticipant[];
  total: number;
};

export type RankedCombinedIndividual = {
    participantId: string;
    firstName: string;
    lastName: string;
    rank: number;
    bestScore: number;
    secondBestScore: number;
    allScores: number[];
}

export type CombinedResults = {
  teams: CombinedTeam[];
  individuals: RankedCombinedIndividual[];
};

export type CombinedSetupFormData = {
    eventName: string;
    participants: { id: string; firstName: string; lastName: string; }[];
    teams: { id: string; name: string; }[];
};


export type CompetitionType = "team" | "individual" | "combined";
