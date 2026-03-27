# Try-On model portraits

Served at `https://<your-app>/model-library/<filename>`.

## Female

| File          | DB `slug`  | `display_name` |
|---------------|------------|----------------|
| `zoe.png`     | `zoe`      | Zoe            |
| `lina.png`    | `lina`     | Lina           |
| `min-ji.png`  | `min-ji`   | Min-Ji         |
| `sophia.png`  | `sophia`   | Sophia         |
| `camila.png`  | `camila`   | Camila         |
| `rashna.png`  | `rashna`   | Rashna         |

## Male

| File          | DB `slug`  | `display_name` |
|---------------|------------|----------------|
| `andrew.png`  | `andrew`   | Andrew         |
| `jack.png`    | `jack`     | Jack           |
| `jordan.png`  | `jordan`   | Jordan         |
| `steve.png`   | `steve`    | Steve          |
| `vandik.png`  | `vandik`   | Vandik         |
| `lucas.png`   | `lucas`    | Lucas          |

Set backend **`FRONTEND_URL`** to your public app URL so the API resolves `/model-library/...` paths.

SQL: `supabase/manual_runs/apply_custom_female_model_portraits.sql` and `apply_custom_male_model_portraits.sql` (or matching migrations).
