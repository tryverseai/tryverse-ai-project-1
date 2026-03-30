/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "false" to block brand self-serve signup (default: allowed). */
  readonly VITE_ENABLE_INVITE_SIGNUP?: string;
  /** Set to "false" to block /auth?signup=individual (default: personal sign-up allowed). */
  readonly VITE_ENABLE_B2C_SIGNUP?: string;
}

declare module "*.mp4" {
  const src: string;
  export default src;
}
