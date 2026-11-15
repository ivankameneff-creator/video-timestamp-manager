import { TopModeNav } from "@/components/ui/TopModeNav";
import { SearchVaultSection } from "@/components/sections/SearchVaultSection";

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-void">
      <TopModeNav
        activeMode="use"
        subtitle="RECHERCHE DE DANSES & FIGURES PAR TIMECODE"
      />
      <main>
        <SearchVaultSection />
      </main>
    </div>
  );
}
