/**
 * Shared tips & best-practices copy for Virtual Try-On (dashboard tabs + studio).
 */
function SectionDivider() {
  return <hr className="border-0 border-t border-border/60 my-8" aria-hidden="true" />;
}

export function TryOnGuideContent() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-6 md:p-10 text-left space-y-0">
      <header className="space-y-2 mb-8">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
          Virtual try-on: tips &amp; guide
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          How to get reliable results in TryVerse—model photos, product shots, and what to expect from the output.
        </p>
      </header>

      <section className="space-y-4">
        <h3 className="font-display text-lg font-semibold text-foreground">Tips for Tops Try-On</h3>
        <ul className="space-y-4 text-sm text-foreground/90 leading-relaxed list-none pl-0">
          <li>
            <span className="font-medium text-foreground">Tip 1:</span> When uploading a top, using a half-body image
            helps produce clearer results and preserves finer details like logos.
          </li>
          <li>
            <span className="font-medium text-foreground">Tip 2:</span> For the best outcome, make sure the clothing
            on the model is similar to the item being tried on. For example, if you&apos;re trying on a short-sleeve
            top, the model should also be wearing short sleeves. Avoid using images where the model is wearing long or
            covering garments like coats or dresses, as this can lead to incorrect sleeve or garment mismatches.
          </li>
          <li>
            <span className="font-medium text-foreground">Tip 3:</span> Try to match the fit of the model&apos;s outfit
            with the item being tested. If the new piece is fitted (like a tank top), it works best when the model is
            already wearing something fitted. Loose outerwear like jackets or cardigans can reduce accuracy and affect how
            the garment is displayed.
          </li>
          <li>
            <span className="font-medium text-foreground">Tip 4 (Dresses / Long Clothing):</span> When working with
            long garments, it&apos;s best for the model to be standing in a neutral pose. Poses with bent limbs or
            overlapping body parts may interfere with how the clothing is rendered.
          </li>
        </ul>
      </section>

      <SectionDivider />

      <section className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-foreground">Bottoms Try-On Tips</h3>
        <p className="text-sm text-foreground/90 leading-relaxed">
          For bottoms, use images where the model shows a full body or at least the lower half. The model should
          preferably be wearing a long top and avoid items like dresses or boots, as these can block or interfere with how
          the bottoms are applied.
        </p>
      </section>

      <SectionDivider />

      <section className="space-y-4">
        <h3 className="font-display text-lg font-semibold text-foreground">Complete Outfits, Shoes &amp; Accessories</h3>
        <ul className="space-y-4 text-sm text-foreground/90 leading-relaxed list-none pl-0">
          <li>
            <span className="font-medium text-foreground">Single reference photo:</span> Personal Studio&apos;s
            &quot;Full outfit&quot; category works from one photo that already shows the complete look. It&apos;s
            best for simple, clearly-photographed outfits — busy or layered garments in one photo can render with
            some detail loss.
          </li>
          <li>
            <span className="font-medium text-foreground">Combining separate pieces:</span> To build a look from
            individual top, bottom, and shoe product photos, use <strong>Outfit Builder</strong> instead of Personal
            Studio. It composites each piece before generating, which preserves multi-garment fidelity far better
            than asking a single photo to represent an entire outfit.
          </li>
          <li>
            <span className="font-medium text-foreground">Shoes:</span> Upload a clear side or three-quarter product
            shot on a plain background, the same as any other garment photo — avoid shoes shown mid-stride or at an
            extreme angle.
          </li>
          <li>
            <span className="font-medium text-foreground">Accessories (bags, eyewear):</span> Supported the same way
            as clothing — upload a clean product photo and a model photo where the relevant area (hands, face) is
            clearly visible and unobstructed.
          </li>
        </ul>
      </section>

      <SectionDivider />

      <section className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-foreground">Notes</h3>
        <p className="text-sm text-foreground/90 leading-relaxed">
          Some variations in clothing details may occur, especially when the item is small in the image or includes
          intricate elements like text or logos. These finer details may not always render perfectly, which is a common
          limitation in virtual try-on systems. We&apos;re continuously improving this and welcome feedback to enhance
          accuracy.
        </p>
      </section>

      <SectionDivider />

      <section className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-foreground">Image Guidelines for Best Results</h3>
        <ul className="list-disc pl-5 text-sm text-foreground/90 space-y-1.5">
          <li>Use clear product images of a single clothing item</li>
          <li>Prefer flat lays with a clean, white background</li>
          <li>Ensure the garment is the main focus of the image</li>
        </ul>
      </section>

      <SectionDivider />

      <section className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-foreground">Results</h3>
        <p className="text-sm text-foreground/90 leading-relaxed">
          Once you upload compatible product and model images, your virtual try-on result should appear within
          approximately <strong>10–13 seconds</strong>.
        </p>
      </section>

      <SectionDivider />

      <footer>
        <p className="text-sm text-muted-foreground leading-relaxed">
          That&apos;s it for the guide! You now know how to get the best results using TryVerse&apos;s Virtual Try-On
          feature. Enjoy creating and experimenting!
        </p>
      </footer>
    </div>
  );
}
