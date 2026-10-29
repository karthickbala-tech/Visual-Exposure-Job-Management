1. frontend-design (by Anthropic)
What it does
Makes Claude commit to a clear aesthetic direction (editorial, brutalist, luxury, playful and so on) before writing
any code. Pushes for distinctive typography, a real color story and layouts that avoid the generic centered hero
with three cards.
Install
/plugin install frontend-design@claude-plugins-official
or
npx skills add anthropics/skills --skill frontend-design
GitHub
github.com/anthropics/skills
2. UI UX Pro Max
What it does
Gives Claude a searchable local library of UI styles, 190+ industry color palettes and 70+ font pairings. Its
reasoning engine turns a product description into a full design system (style, palette, fonts, spacing, what to
avoid) before building. Supports 20+ stacks.
Install
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
or
npm install -g ui-ux-pro-max-cli
uipro init --ai claude
GitHub
github.com/nextlevelbuilder/ui-ux-pro-max-skill
3. Taste Skill
What it does
A pack of skills with concrete, metric-driven rules for layout, typography, motion and spacing. Includes style
variants (minimalist-ui, industrial-brutalist-ui, high-end-visual-design) and redesign-existing-projects, which
audits and fixes an existing codebase.
Install
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"
Remove the --skill flag to install the full pack.
GitHub
github.com/Leonxlnx/taste-skill

4. Impeccable (by Paul Bakaus)
What it does
A full design toolkit inside Claude Code: one skill plus 20+ commands under /impeccable. Breaks design work
into repeatable steps, such as critique first and then polish, like working with a designer who follows a checklist.
Key commands
/impeccable init Set up the project's design direction
/impeccable audit Technical quality checks
/impeccable critique Full UX review
/impeccable polish Final refinement pass
/impeccable typeset Focused typography pass
/impeccable colorize Focused color pass
/impeccable animate Focused motion pass
/impeccable live Iterate visually in the browser
Install
/plugin marketplace add pbakaus/impeccable
Then open /plugin and install Impeccable.
GitHub
github.com/pbakaus/impeccable
5. Emil Kowalski's Skills
What it does
Motion and interaction polish from the design engineer behind Sonner and Vaul. Teaches Claude the right
easing, duration and animatable properties so dropdowns, modals and transitions feel like a real product instead
of a static demo.
Key commands
animate Build animations with correct easing, duration and properties
review-animations Audit existing motion against strict rules
find-animation-opportunities Point out where motion would help
apple-design Apple-style design guidance
mobile-native Web-to-app native polish
prototype Build multiple UI versions with a switcher to compare
Install
npx skills@latest add emilkowalski/skills
GitHub
github.com/emilkowalski/skills

6. Interface Design
What it does
Sets a design direction and saves decisions (button heights, spacing, radius, colors, patterns) to
.interface-design/system.md. Claude reads it every session, so new pages stay consistent with earlier ones
instead of drifting.
Key commands
/interface-design:design-review Strict craft and hierarchy review
/interface-design:design-deslop Fast cleanup pass on generated UI
Install
npx skills add https://github.com/dammyjay93/interface-design --skill interface-design
--agent claude-code -g
or
/plugin marketplace add Dammyjay93/interface-design
GitHub
github.com/Dammyjay93/interface-design
7. shadcn/ui Skill (official)
What it does
Reads your components.json so Claude knows your framework, installed components, icon library and theme.
Uses the shadcn CLI correctly for adding components, theming with CSS variables, dark mode, variants and
custom registries.
Install
npx skills add shadcn/ui
or
pnpm dlx skills add shadcn/ui
GitHub
github.com/shadcn-ui/ui
8. Web Design Guidelines (by Vercel)
What it does
Reviews UI code against 100+ rules from Vercel's interface guidelines: accessibility, focus states, forms,
reduced motion, typography details, image dimensions, dark mode, touch and locale formatting. Best used as a
pre-ship check.
Install
npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines
GitHub
github.com/vercel-labs/agent-skills

9. webapp-testing (by Anthropic)
What it does
Lets Claude use Playwright to open your app, take screenshots, click through flows and read browser logs.
Claude can see what it built and fix visual bugs, like an overlapping mobile nav, before you open the browser.
Install
/plugin marketplace add anthropics/skills
/plugin install example-skills@anthropic-agent-skills
GitHub
github.com/anthropics/skills