import { useRef, useCallback, type ChangeEvent } from "react";

/**
 * Wires a hidden native file input so an action button can open the OS file picker directly,
 * with no intermediate "drop your file here" screen. Render `<input ref={inputRef} type="file"
 * className="sr-only" onChange={onChange} />` once and call `open()` from any trigger.
 */
export function useFilePicker(onFile: (file: File) => void) {
  const inputRef = useRef<HTMLInputElement>(null);

  const open = useCallback(() => inputRef.current?.click(), []);

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) onFile(f);
      e.target.value = "";
    },
    [onFile]
  );

  return { inputRef, open, onChange };
}
