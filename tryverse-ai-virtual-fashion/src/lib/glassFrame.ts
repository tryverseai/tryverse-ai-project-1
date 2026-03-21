/**
 * Shared “frosted glass” rim + pane styles for marketing sections (How it works, Platform, etc.)
 */
export const GLASS_EASE = [0.22, 1, 0.36, 1] as const;

/** Gradient border ring — use with `p-px` */
export const glassOuter =
  "group relative overflow-hidden rounded-2xl p-px sm:rounded-[28px] bg-gradient-to-br from-slate-400/25 via-slate-300/15 to-slate-400/10 shadow-[0_0_0_1px_rgba(15,23,42,0.06)_inset] transition-[background,box-shadow,filter] duration-[900ms] ease-out hover:from-slate-400/35 hover:via-slate-300/22 hover:to-slate-400/15 hover:shadow-[0_0_0_1px_rgba(15,23,42,0.08)_inset,0_20px_60px_rgba(15,23,42,0.08)]";

/** Inner frosted pane (base — add padding / flex via cn) */
export const glassInner =
  "relative overflow-hidden rounded-[15px] sm:rounded-[27px] bg-white/55 backdrop-blur-[20px] supports-[backdrop-filter]:backdrop-blur-[28px] backdrop-saturate-150 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95),inset_1px_0_0_0_rgba(255,255,255,0.5),0_1px_0_0_rgba(15,23,42,0.04)] transition-[background-color,backdrop-filter,box-shadow] duration-[900ms] ease-out group-hover:bg-white/75 group-hover:backdrop-blur-[34px] group-hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,1),inset_1px_0_0_0_rgba(255,255,255,0.65),0_8px_32px_rgba(15,23,42,0.06)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[15px] sm:before:rounded-[27px] before:content-[''] before:bg-gradient-to-br before:from-white/80 before:via-transparent before:to-transparent before:opacity-90 before:transition-opacity before:duration-[900ms] before:ease-out group-hover:before:opacity-100";

/** Default padding + flex column for feature / step cards */
export const glassInnerCard =
  `${glassInner} px-5 py-6 sm:px-8 sm:py-8 h-full min-h-0 flex flex-col`;

/** Light section backdrop (behind glass) */
export const glassSectionBackdrop =
  "pointer-events-none absolute inset-0 bg-gradient-to-b from-muted/35 via-white to-muted/25";
