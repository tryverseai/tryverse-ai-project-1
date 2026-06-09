import { useState, useEffect } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { turnstileSiteKey } from "@/lib/turnstileEnv";

type TurnstileWidgetProps = {
  onSuccess: (token: string) => void;
  onExpire?: () => void;
  /** Called when Turnstile cannot load — parent should skip token requirement. */
  onUnavailable?: () => void;
};

/**
 * Cloudflare Turnstile with graceful failure — if the widget cannot load,
 * the form remains usable without showing an error to the user.
 */
export function TurnstileWidget({ onSuccess, onExpire, onUnavailable }: TurnstileWidgetProps) {
  const siteKey = turnstileSiteKey();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!siteKey) onUnavailable?.();
  }, [siteKey, onUnavailable]);

  if (!siteKey || failed) return null;

  return (
    <div className="flex min-h-[72px] w-full justify-center py-2">
      <Turnstile
        siteKey={siteKey}
        options={{ appearance: "always", size: "normal" }}
        onSuccess={(t) => onSuccess(t)}
        onExpire={() => onExpire?.()}
        onError={() => {
          setFailed(true);
          onUnavailable?.();
        }}
      />
    </div>
  );
}
