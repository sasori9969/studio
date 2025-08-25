import ScoreVault from "@/components/score-vault";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center p-4 sm:p-8 md:p-12">
      <div className="w-full max-w-6xl">
        <ScoreVault />
      </div>
    </main>
  );
}
