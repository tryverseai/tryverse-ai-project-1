import { Upload, Users } from "lucide-react";
import { GeneratorEntry } from "@/components/dashboard/GeneratorEntry";

interface StudioEntryProps {
  onUploadPhoto: () => void;
  onChooseModel: () => void;
}

/** Personal Studio's landing screen — one editorial moment, two ways in, no dashboard clutter. */
export function StudioEntry({ onUploadPhoto, onChooseModel }: StudioEntryProps) {
  return (
    <GeneratorEntry
      title="Experience it on You"
      subtitle="Upload a photo or pick a model, then see any product on them in seconds."
      actions={[
        { label: "Upload a photo", icon: Upload, onClick: onUploadPhoto, variant: "primary" },
        { label: "Choose a virtual model", icon: Users, onClick: onChooseModel, variant: "onInk" },
      ]}
    />
  );
}
