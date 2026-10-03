# Design system

GymOS should look like it belongs to a strength gym, not like a generic admin template. The visual language comes from the gym floor: competition bumper plates, the chalk tray, painted floor markings and the scoreboard.

## Colour

Two colours with a job each, over cool neutrals. Defined as CSS variables in `app/globals.css` and the only colours Tailwind knows about (`tailwind.config.ts` replaces the default palette).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `plate` | #1F5AA6 | #7FAAF0 | Primary actions, links, focus rings, the active nav item. The blue of a 20 kg competition plate. |
| `chalk` | #F2C230 | #F2C230 | The one highlight: alert numbers on the scoreboard, text selection. The yellow of a 15 kg plate. Never body text on light backgrounds. |
| `floor` | #EFF1EF | #121619 | Page background. Cool concrete grey, deliberately not cream. |
| `surface` | #FFFFFF | #1A1F23 | Panels, dialogs, inputs. |
| `sunken` | #E3E7E7 | #21282D | Hover, neutral tags, skeletons. |
| `ink` / `ink-soft` | #15191C / #565F66 | #E8ECEE / #9AA5AC | Text. |
| `line` / `line-strong` | #D5DADC / #A0A9AE | #2F373D / #546068 | Borders. Inputs use `line-strong` so their edges are visible. |
| `good` / `warn` / `bad` | #276B43 / #7A5B00 / #A92621 | #6FCB93 / #F0C85A / #F07A72 | Status only. `bad` is plate red. |
| `board` / `board-ink` / `board-soft` | #15191C / #EFF1EF / #B0BAC0 | #090C0E / #E8ECEE / #9AA5AC | The scoreboard strip. Stays dark in both themes. |

Contrast (computed, WCAG 2.1): body text 15.3:1 (dark) and above 14:1 (light); `ink-soft` on `floor` 5.74:1; white on `plate` 6.84:1; status text on its tint 5.4:1 or more; `chalk` on `board` 10.55:1. Every pair used for text passes AA. axe runs on the main flows in CI.

## Type

- **Display:** Barlow Condensed 500/600/700. Headings and numbers. Its proportions come from road and gym signage, and its condensed figures make the scoreboard work.
- **Body:** Atkinson Hyperlegible Next. Designed by the Braille Institute for low-vision readers: distinct letterforms (I, l and 1 never look alike), which matters on a front-desk screen read at a glance.
- **Scale:** 1.25 ratio from 16px: 12, 14, 16, 20, 25, 31, 39, 49, 76. Body text is 16px; dense staff tables use 14px. Money and counts use tabular figures (`.tabular`).
- **Avoided:** Inter, Space Grotesk, Geist, all-caps labels, eyebrow text above headings, gradient text, one accented word per headline.

## Shape and depth

- Radii: 4px (`sm`, tags), 6px (default, buttons and inputs), 10px (`lg`, panels and dialogs). Nothing is a pill except the theme switch track.
- Shadows: none on the page. Only overlays (dialogs, toasts, the drawer) get the single `shadow-overlay`.
- Borders do the separating. Lists inside panels are divided by 1px rules, not chopped into separate cards.
- Status tags are small squared labels with a short bar on the left, like a label on a piece of equipment.

## Layout

- Staff console: left sidebar on wide screens; on phones, a top bar with the original slide-in drawer. Content max width 72rem, left-aligned.
- Lists use `DataList`: a real table on wide screens, stacked rows with a definition list on phones. Nothing scrolls sideways at 375px (checked in tests).
- Tap targets are at least 44×44px.
- Forms: visible labels above fields, hints and errors linked with `aria-describedby`, errors in plain words next to the field.

## The one loud thing

The scoreboard: today's numbers in big condensed figures on a dark strip, with any number that needs action in plate yellow. Everything else stays quiet so it reads first. Don't add a second loud element to a page.

## States

Every data view handles four states with shared components: loading (`LoadingRows` skeletons with a screen-reader label), empty (`EmptyState` saying what to do next), error (`ErrorState` with "Try again"), and data. Errors are specific ("That email is already in use") and don't apologise.

## Motion

Almost none. Spinners on busy buttons and skeleton pulse while loading. `prefers-reduced-motion` turns even those off.

## Copy

Plain verbs, sentence case, Australian spelling, no filler ("seamless", "elevate", "unlock"), no em dashes. Buttons say what happens ("Archive member", not "Submit"). Money is always AUD and says whether it includes GST.
