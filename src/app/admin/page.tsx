import { TopModeNav } from "@/components/ui/TopModeNav";
import { DirectoryAdminSection } from "@/components/sections/DirectoryAdminSection";

export default function AdminPage() {
  return (
    <div className="min-h-dvh bg-void">
      <TopModeNav activeMode="admin" subtitle="MODE ADMIN" />
      <main>
        <DirectoryAdminSection />
      </main>
    </div>
  );
}
