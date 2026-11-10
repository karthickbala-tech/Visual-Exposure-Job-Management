# Design Reference: visualexposure.com.au

The staff app takes its identity from the public site (https://www.visualexposure.com.au/), measured on 2026-11-02. The app is a tool, not a marketing page, so it borrows the **brand language** (type, colour, rhythm, tone) and uses it in dense, usable screens. The collaborator's dark demo (`react-app/`) is a secondary layout reference only.

## Brand tokens (measured from the live site)

| Token | Value | Use |
|---|---|---|
| `--ink` | `#1B1B1E` | headings, body text on light |
| `--ink-muted` | `#545456` | secondary text |
| `--slate` | `#42484D` | dark bands, app sidebar and top bar, table headers |
| `--grey-band` | `#C6C6C7` | light grey sections, dividers |
| `--grey-mid` | `#8D8D8F` | disabled, hairlines |
| `--paper-alt` | `#FAFAFA` | alternate row / card background |
| `--paper` | `#FFFFFF` | page background |
| `--accent` | `#68B04D` | the brand green: active nav, short heading bar, primary actions, "completed" |
| `--accent-ink` | `#FFFFFF` | text on green |
| `--link` | `#4E5AC3` | links and secondary actions (the site's button colour) |

Status colours (kept apart from the brand accent so a job state never reads as "brand"): In Progress `#3D9BE9` blue, On Hold `#FFCB05` amber, Cancelled / Rejected `#ED1C24` red, Completed `#68B04D` green, Preparation `#8D8D8F` grey. All text on these meets WCAG AA; check each pairing in the component tests.

## Typography

| Role | Font | Spec |
|---|---|---|
| Headings | **Raleway 700**, UPPERCASE | site uses 80-90 px; in the app scale to a 5-step ramp (36 / 28 / 22 / 18 / 14 px), line-height 1.1 to 1.2 |
| Body | **Raleway 400** | 16 px / 25.6 px; tables and dense UI 14 px |
| Navigation and buttons | Raleway 600, uppercase, 14 px, letter-spacing +0.04em | |
| Numbers (KPIs, hours, money) | Raleway 700 with `font-variant-numeric: tabular-nums` | |

Raleway is a Google Font. The site's secondary light face (DIN Next) is licensed, so we do not use it.

## Layout and rhythm

- **Full-width horizontal bands** alternating white, light grey (`#C6C6C7`) and slate (`#42484D`).
- **Section heading signature:** a short green bar (about 48 x 6 px, `#68B04D`) above a large uppercase Raleway heading, usually split over two lines ("OUR / WORK", "WHO / WE ARE").
- **Dark top bar** with the green-and-white logo on the left, uppercase nav on the right, active item in green.
- Generous white space, square photography tiles in a grid with small uppercase captions, flat surfaces, **no shadows or gradients**, 3 px corner radius on buttons.
- Tone of voice: short, confident, plain ("Done Properly", "Challenging jobs are our speciality").

## How the app uses it

| App area | Treatment |
|---|---|
| Login page | Slate band header with the logo, white card, one green primary button, headline "SIGN IN" with the green bar |
| Shell | Slate left sidebar and top bar; active nav item green; page title as two-line uppercase heading with green bar |
| Dashboards | White page, KPI tiles on `#FAFAFA` with big tabular numbers; grey band for secondary sections |
| Tables and lists | Slate header row, `#FAFAFA` zebra rows, status chips in the status colours |
| Forms and checklists | Large touch targets (min 44 px), one question group per screen on mobile, green primary action pinned at the bottom |
| Empty and error states | Short plain sentence, no illustrations |

## Assets

- **Logo:** the site serves it from Wix (`static.wixstatic.com`). Do not hot-link it. Use the client's supplied logo file (`react-app/img/visual_exposure_logo.avif` is in the repo, untracked) converted to SVG/PNG.
- Photography is the client's; the app shows none except job and sign photos the crews upload.

## Accessibility and quality gates

- Contrast AA minimum; green `#68B04D` on white is about 2.7:1, so **never use green for small text on white**. Use it for bars, fills (with white text at 16 px bold or larger), borders and icons only. Use `--ink` for text on light backgrounds.
- Focus outlines visible; reduced-motion respected; keyboard operable tables and dialogs.
- Every screen checked with the installed `web-design-guidelines` skill before it is called done, and designed with the `frontend-design` skill's direction: commit to this brand, avoid generic templates.

## Re-check against the live site (2026-11-10)

Measured again from the site's own theme variables. Font: Raleway (bold for headings, regular for body 14 px at line-height 1.4; the light DIN Next face is licensed and not used). Palette: ink `#1B1B1E`, greys `#545456` `#5D5D61` `#8D8D8F` `#C6C6C7`, sidebar slate `#42484D`, brand green `#68B04D` (the site's button border), red `#ED1C24`, blue `#0088CB`, yellow `#FFCB05`, link indigo `#4E5AC3`. The app's light theme now uses these exact neutral greys (the earlier greys had a green tint), the site's red for danger and its blue for info, body line-height 1.4, and the short green bar above each page title. The dark theme keeps its own darker values.
