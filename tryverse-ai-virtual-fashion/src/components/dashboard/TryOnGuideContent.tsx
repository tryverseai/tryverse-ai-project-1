/**
 * Shared tips & best-practices copy for Virtual Try-On (dashboard tabs + studio).
 */
export function TryOnGuideContent() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-6 md:p-10 text-left space-y-10">
      <header className="space-y-2">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
          Virtual Try-On tips &amp; guide
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Get clearer results and fewer surprises by following these suggestions for photos, fits, and product images.
        </p>
      </header>

      <section className="space-y-4">
        <h3 className="font-display text-lg font-semibold text-foreground">Tips for tops try-on</h3>
        <ul className="space-y-4 text-sm text-foreground/90 leading-relaxed list-none pl-0">
          <li>
            <span className="font-medium text-foreground">Tip 1:</span> When uploading an image of a top, using a
            half-body photo can enhance the clarity of the try-on result and improve the retention of logo details.
          </li>
          <li>
            <span className="font-medium text-foreground">Tip 2:</span> To ensure the best try-on effect, the type of
            clothing being tried on should closely match what the model is wearing. For example, if trying on a
            short-sleeve top, the model should also wear a short-sleeve item. Similarly, if trying on a top, the model
            should not be dressed in long garments like dresses or trench coats. This helps avoid mismatches, such as
            switching from short sleeves to long sleeves or vice versa.
          </li>
          <li>
            <span className="font-medium text-foreground">Tip 3:</span> The fit of the clothing being tried on should
            closely match the fit of what the model is originally wearing. For example, if trying on a fitted item like
            a tank top, the model should ideally not be wearing loose clothing, such as a cardigan or jacket, as this
            may prevent the fitted item from being showcased effectively.
          </li>
          <li>
            <span className="font-medium text-foreground">Tip 4 (dress / long clothing):</span> When trying on long
            clothing, it is best to have the model maintain a standing posture to avoid poses that involve folding or
            overlapping of the body.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-foreground">Bottoms try-on tips</h3>
        <p className="text-sm text-foreground/90 leading-relaxed">
          When trying on bottoms, opt for models displaying full body or at least the lower half. Models should wear long
          top garments, preferably avoiding boots or dresses, as these may prevent bottoms from being put on. Suitable
          for platform display.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-foreground">III. Notes</h3>
        <p className="text-sm text-foreground/90 leading-relaxed">
          Discrepancies may occur in the try-on clothing details, especially when the clothing occupies a small portion
          of the image or contains fine text. This can result in inaccuracies with small text and logo details, a common
          challenge in virtual try-on technology. We will continue to optimize this aspect and welcome user feedback.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-foreground">Single clothing item (product photo)</h3>
        <ul className="list-disc pl-5 text-sm text-foreground/90 space-y-1.5">
          <li>White background flat lay</li>
          <li>Simple and clear clothing details</li>
          <li>Focus on the garment as the main subject</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-foreground">Generated results</h3>
        <p className="text-sm text-foreground/90 leading-relaxed">
          After uploading compliant product and model images, wait <strong>10–13 seconds</strong> to receive the virtual
          try-on result.
        </p>
      </section>

      <footer className="pt-4 border-t border-border/50">
        <p className="text-sm text-muted-foreground leading-relaxed">
          That&apos;s the end of this guide! We&apos;ve covered how to use the Virtual Try-On feature in TryVerse, along
          with tips to make the most of it. We hope this helps support your creative projects!
        </p>
      </footer>
    </div>
  );
}
