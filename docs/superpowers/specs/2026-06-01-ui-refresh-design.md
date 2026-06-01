# Koala Code Webview UI Refresh Design

Date: 2026-06-01
Topic: modern neon AI / cyberpunk-inspired webview refresh with rainbow loading states

## Summary
This design refresh modernizes the Koala Code webview while staying compatible with the existing VS Code theme foundation. The update introduces a polished neon-accented interface, a global animated rainbow loading bar, and a richer in-thread status card that replaces the current plain thinking row. The goal is to make the experience feel more premium, alive, and readable without changing the core layout or requiring backend protocol changes.

## Goals
- Make the webview look more modern and visually intentional
- Keep the UI compatible with VS Code theme colors, using subtle neon accents rather than a full custom palette
- Add animated rainbow loading feedback while the agent is responding
- Replace the current minimal thinking row with a more expressive status card
- Improve clarity of agent state during response generation and approval waits
- Keep the work scoped primarily to the existing webview frontend

## Non-Goals
- No backend protocol redesign
- No change to core chat data structures
- No new settings UI for theme customization in this pass
- No full application layout rewrite
- No changes to the CLI UI

## Current State
The current webview UI is concentrated in `apps/webview/src/App.tsx` and `apps/webview/src/index.css`.

Current characteristics:
- Basic header, provider/model context, messages list, and input bar
- Minimal styling built on VS Code CSS variables and Tailwind utility classes
- Agent activity is represented by a simple text row with a pulsing bot icon and timer
- No progress bar or rich state visualization
- Messages render as simple rows rather than elevated or grouped chat surfaces

## Design Direction
The approved direction is “neon AI / cyberpunk” with restraint.

This means:
- Preserve the dark VS Code-compatible base colors from theme tokens
- Add modern neon accents for active states, borders, glow, and gradients
- Use soft visual depth, rounded corners, layered panels, and stronger spacing rhythm
- Avoid a fully custom bright palette that would fight the host editor environment

The design should feel premium and futuristic, but still believable inside a VS Code sidebar.

## Proposed Approach
This work follows a moderate redesign rather than a full rebuild.

The existing structure remains:
- Header
- Task/context strip
- Message thread
- Input composer
- Settings modal behavior

Visual changes are layered onto that structure so the implementation stays low-risk and focused.

## UI Changes

### 1. Global Active-State Progress Bar
A thin animated rainbow progress bar appears directly under the header whenever the agent is active.

Behavior:
- Visible when `agentStatus` is `working` or `waiting`
- Hidden when `agentStatus` is `idle`
- Uses a horizontally animated rainbow gradient
- Includes a soft glow treatment to reinforce activity
- Should not occupy excessive vertical space

Purpose:
- Provide immediate, always-visible feedback that the agent is busy
- Add a distinct premium visual identity without overwhelming the layout

### 2. Rich In-Thread Status Card
The current plain “Thinking...” row is replaced with a more expressive loading/status card in the message stream.

Card contents:
- Bot icon or status indicator
- Main state label
- Secondary staged message
- Elapsed timer
- Animated rainbow progress bar

State mapping:
- `working` displays a primary state such as “Thinking” with rotating or pulsing secondary copy such as “Planning response”, “Reviewing context”, or similar text-only staged messages
- `waiting` displays “Waiting for approval” with corresponding secondary guidance
- `idle` renders no status card

Important constraint:
Because current frontend state appears to expose `idle | working | waiting`, staged sub-messages will be frontend-presentational only in this pass. They will not claim to reflect deep backend phases unless that data already exists.

### 3. Message Presentation Refresh
Message rows will be restyled into more modern chat surfaces.

Expected changes:
- Better spacing between messages
- Rounded message containers or grouped text surfaces
- Distinct styling between user and agent messages
- Improved visual hierarchy for avatar/icon, content, and active status
- Higher legibility for longer assistant responses

The intent is to keep rendering logic simple while significantly improving perceived polish.

### 4. Header and Context Surface Polish
The existing header and provider/model strip remain, but gain refined visual treatment.

Expected changes:
- More intentional spacing and alignment
- Slightly elevated panel feel
- Subtle border and background treatments
- Neon accent usage on active controls or brand icon only
- Maintain readability and small-sidebar friendliness

### 5. Input Composer Polish
The input row remains structurally the same but is restyled to fit the refreshed system.

Expected changes:
- Improved border and focus treatment
- Slightly more premium button styling
- Better visual disabled state while the agent is active
- Cohesion with the rest of the neon-accented surfaces

## Styling Strategy
Implementation should continue using the current stack already present in the project:
- React
- Tailwind utility classes
- Global CSS in `apps/webview/src/index.css`
- VS Code CSS variables as the base theme layer

Styling should be split as follows:
- Reusable animation tokens and custom gradient/glow rules in `index.css`
- Structural and contextual styling in `App.tsx` via utility classes

This keeps the styling maintainable and consistent with the current project setup.

## Accessibility and Usability Considerations
- Animations should feel smooth but not distracting
- Important state text must remain readable even if gradient visuals are ignored
- The UI must preserve adequate contrast against editor backgrounds
- Busy states must still clearly disable input interactions where appropriate
- The status card should communicate useful text state, not rely on color alone

## Implementation Scope
Primary files expected to change:
- `apps/webview/src/App.tsx`
- `apps/webview/src/index.css`

Optional scope only if required by implementation details:
- Small supporting extraction inside the webview app if the status UI becomes too large to keep inline

This pass should avoid broad refactors unless they directly support the UI refresh.

## Testing and Verification
After implementation, verify:
- The webview frontend builds successfully
- Lint passes for the updated webview code
- Active-state visuals appear only during `working` and `waiting`
- Idle state hides loading UI cleanly
- Disabled input/button behavior still works correctly while active
- Message rendering remains stable for both user and agent messages
- The refreshed design remains readable inside the constrained sidebar layout

## Risks and Mitigations

### Risk: Overly flashy visuals clash with VS Code
Mitigation:
Use VS Code theme variables as the base and keep neon effects limited to accents, active states, and progress feedback.

### Risk: Loading states imply backend phases that do not exist
Mitigation:
Keep staged messages clearly presentational and generic unless real backend phase data is added later.

### Risk: UI becomes crowded in a narrow sidebar
Mitigation:
Favor thin progress indicators, compact cards, and tight spacing discipline.

## Future Follow-Ups
Possible later enhancements, not included in this pass:
- Real backend-driven fine-grained status updates
- Theme customization intensity settings
- Rich markdown rendering for assistant messages
- Better message grouping and conversation metadata
- Polished empty state artwork or onboarding treatment

## Acceptance Criteria
This design is successful when:
- The webview feels noticeably more modern and premium
- The loading experience includes both a global top rainbow bar and a richer in-thread status card
- The status card replaces the old plain thinking row
- The refreshed visuals remain mostly compatible with VS Code theming
- The implementation stays focused and does not require backend changes
