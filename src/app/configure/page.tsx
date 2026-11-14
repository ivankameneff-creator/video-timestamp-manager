import { TopModeNav } from "@/components/ui/TopModeNav";
import { TaggingStudioSection } from "@/components/sections/TaggingStudioSection";

export default async function ConfigurePage({
  searchParams,
}: {
  searchParams: Promise<{ videoId?: string }>;
}) {
  const { videoId } = await searchParams;

  return (
    <div className="min-h-dvh bg-void">
      <TopModeNav activeMode="configure" subtitle="MODE CONFIGURE" />
      <main>
        <TaggingStudioSection initialVideoId={videoId} />
      </main>
    </div>
  );
}
