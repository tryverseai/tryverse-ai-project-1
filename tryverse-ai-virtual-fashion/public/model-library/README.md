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
| `stephanie.png` | `stephanie` | Stephanie   |
| `asher.png`   | `asher`    | Asher          |
| `hanna.png`   | `hanna`    | Hanna          |
| `mia.png`     | `mia`      | Mia            |
| `louis.png`   | `louis`    | Louis          |
| `aiko.png`    | `aiko`     | Aiko           |
| `nicole.png`  | `nicole`   | Nicole         |
| `diane.png`   | `diane`    | Diane          |

## Male

| File          | DB `slug`  | `display_name` |
|---------------|------------|----------------|
| `andrew.png`  | `andrew`   | Andrew         |
| `jack.png`    | `jack`     | Jack           |
| `jordan.png`  | `jordan`   | Jordan         |
| `steve.png`   | `steve`    | Steve          |
| `vandik.png`  | `vandik`   | Vandik         |
| `lucas.png`   | `lucas`    | Lucas          |
| `max.png`     | `max`      | Max            |
| `li-xeng.png` | `li-xeng`  | Li Xeng        |
| `jed.png`     | `jed`      | Jed            |
| `alex.png`    | `alex`     | Alex           |
| `alfred.png`  | `alfred`   | Alfred         |
| `derrick.png` | `derrick`  | Derrick        |

Set backend **`FRONTEND_URL`** to your public app URL so the API resolves `/model-library/...` paths.

SQL: `supabase/manual_runs/apply_custom_female_model_portraits.sql`, `apply_female_stephanie_diane_batch.sql`, `apply_custom_male_model_portraits.sql`, `apply_max_li_xeng_male_models.sql`, `apply_jed_male_model.sql`, `apply_alex_alfred_derrick_male_models.sql` (or matching migrations).
