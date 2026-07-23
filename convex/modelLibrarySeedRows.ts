/**
 * Canonical default catalog for Try-On Studio / GET /api/models.
 * Shared by seed.ts and backendTrusted.ensureModelLibrarySeeded.
 */

export type DefaultModelLibraryRow = {
  slug: string;
  display_name: string;
  gender: "female" | "male";
  image_url: string;
  sort_order: number;
  is_active: boolean;
  free_tier_eligible: boolean;
  created_at?: string;
};

export function defaultModelLibraryRows(now: string): DefaultModelLibraryRow[] {
  const female: Array<{ slug: string; display_name: string }> = [
    { slug: "zoe", display_name: "Zoe" },
    { slug: "lina", display_name: "Lina" },
    { slug: "min-ji", display_name: "Min-Ji" },
    { slug: "sophia", display_name: "Sophia" },
    { slug: "camila", display_name: "Camila" },
    { slug: "rashna", display_name: "Rashna" },
    { slug: "stephanie", display_name: "Stephanie" },
    { slug: "asher", display_name: "Asher" },
    { slug: "hanna", display_name: "Hanna" },
    { slug: "mia", display_name: "Mia" },
    { slug: "louis", display_name: "Louis" },
    { slug: "aiko", display_name: "Aiko" },
    { slug: "nicole", display_name: "Nicole" },
    { slug: "diane", display_name: "Diane" },
  ];
  const male: Array<{ slug: string; display_name: string }> = [
    { slug: "andrew", display_name: "Andrew" },
    { slug: "jack", display_name: "Jack" },
    { slug: "jordan", display_name: "Jordan" },
    { slug: "steve", display_name: "Steve" },
    { slug: "vandik", display_name: "Vandik" },
    { slug: "lucas", display_name: "Lucas" },
    { slug: "max", display_name: "Max" },
    { slug: "li-xeng", display_name: "Li Xeng" },
    { slug: "jed", display_name: "Jed" },
    { slug: "alex", display_name: "Alex" },
    { slug: "alfred", display_name: "Alfred" },
    { slug: "derrick", display_name: "Derrick" },
  ];

  const rows: DefaultModelLibraryRow[] = [];
  let order = 0;
  for (const m of female) {
    rows.push({
      slug: m.slug,
      display_name: m.display_name,
      gender: "female",
      image_url: `/model-library/${m.slug}.png`,
      sort_order: order++,
      is_active: true,
      free_tier_eligible: m.slug === "diane",
      created_at: now,
    });
  }
  for (const m of male) {
    rows.push({
      slug: m.slug,
      display_name: m.display_name,
      gender: "male",
      image_url: `/model-library/${m.slug}.png`,
      sort_order: order++,
      is_active: true,
      free_tier_eligible: m.slug === "andrew",
      created_at: now,
    });
  }
  return rows;
}
