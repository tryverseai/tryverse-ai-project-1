/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "true" to allow /auth?signup=true invite registration (after waitlist approval). */
  readonly VITE_ENABLE_INVITE_SIGNUP?: string;
}

declare module "*.mp4" {
  const src: string;
  export default src;
}
