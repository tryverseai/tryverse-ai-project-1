import { useEffect, useState } from "react";
import {
  getTryverseModels,
  getSavedAiModels,
  type TryverseModel,
  type AiModelResult,
} from "@/lib/backendApi";

export type PickedModel =
  | { source: "generated"; id: string; imageUrl: string; storagePath: string; label: string }
  | { source: "library"; id: string; imageUrl: string; label: string };

interface ModelPickerGridProps {
  selectedId?: string | null;
  onSelect: (model: PickedModel) => void;
  className?: string;
}

/** Shared saved-model + library-model picker grid — used by Personal Studio, AI Photoshoot, Outfit Builder. */
export function ModelPickerGrid({ selectedId, onSelect, className }: ModelPickerGridProps) {
  const [libraryModels, setLibraryModels] = useState<TryverseModel[]>([]);
  const [savedModels, setSavedModels] = useState<AiModelResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getTryverseModels().catch(() => []), getSavedAiModels().catch(() => [])])
      .then(([library, saved]) => {
        if (cancelled) return;
        setLibraryModels(library);
        setSavedModels(saved);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="text-xs text-muted-foreground">Loading models…</p>;
  if (savedModels.length === 0 && libraryModels.length === 0) {
    return <p className="text-xs text-muted-foreground">No models available yet.</p>;
  }

  return (
    <div className={`grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-3 ${className ?? ""}`}>
      {savedModels.map((m) => (
        <button
          key={`gen-${m.id}`}
          type="button"
          onClick={() =>
            onSelect({
              source: "generated",
              id: m.id,
              imageUrl: m.imageUrl,
              storagePath: m.storagePath,
              label: "Your model",
            })
          }
          className={`aspect-[3/4] rounded-lg overflow-hidden border-2 transition-colors ${
            selectedId === m.id ? "border-foreground" : "border-transparent"
          }`}
        >
          <img src={m.imageUrl} alt="Your generated model" className="w-full h-full object-cover" />
        </button>
      ))}
      {libraryModels.map((m) => (
        <button
          key={`lib-${m.slug}`}
          type="button"
          onClick={() =>
            onSelect({ source: "library", id: m.slug, imageUrl: m.image_url, label: m.display_name })
          }
          className={`aspect-[3/4] rounded-lg overflow-hidden border-2 transition-colors ${
            selectedId === m.slug ? "border-foreground" : "border-transparent"
          }`}
          title={m.display_name}
        >
          <img src={m.image_url} alt={m.display_name} className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  );
}
