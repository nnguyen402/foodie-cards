# Shared mobile UI foundation

React Native Reusables is installed into the existing Expo app. This is a shared control foundation, not the final card or screen design. Task A backend/progression work stays in its own pull request.

## Start after pulling main

Update your feature branch from `main`, then run from the repository root:

```powershell
npm ci
npm --workspace @foodie-cards/mobile run start -- --clear
```

Do not run the Reusables `init` command: it creates a new project. Do not install a separate styling stack in each lane. The root lockfile records the shared dependencies; coordinate dependency changes through the integrator.

## Component ownership

- New Reusables components live in `mobile/src/components/ui/reusables`. Registry aliases point here to protect the existing app controls.
- Existing `Button`, `AppText`, and `FormField` imports remain supported. Preserve their public props when migrating a screen.
- Use shared semantic color names, typography, spacing, and radius tokens. Customize component variants centrally rather than adding a different button implementation in each feature.
- Keep card layouts, stage treatments, capture UI, and screen-specific composition in their feature folders. Platform navigation, native sheets, and native pickers still follow the Expo native UI guidance.

New controls use the Reusables composition API:

```tsx
import { Button } from '@/components/ui/reusables/button';
import { Text } from '@/components/ui/reusables/text';
import { Input } from '@/components/ui/reusables/input';

<Input accessibilityLabel="Restaurant name" value={name} onChangeText={setName} />
<Button onPress={save} loading={saving} accessibilityLabel="Save restaurant">
  <Text>Save restaurant</Text>
</Button>
```

Wrap button labels in the shared `Text` component so their foreground follows the button variant. Existing app buttons continue to accept their `label` prop. The canonical palette is in `mobile/src/theme/tokens.ts`; the NativeWind bridge is `mobile/src/lib/theme.ts`. Keep appearance changes there so both UI lanes share them.

Add a needed registry component from the mobile workspace:

```powershell
cd mobile
npx @react-native-reusables/cli@0.7.1 add badge
```

Review the generated code and dependencies before committing. The components are source files owned by our repository, not a remotely updated runtime library. Do not pass `--overwrite` against customized controls without reviewing the diff.

## Team tasks

- **B+C teammate:** use the shared controls in receipt confirmation and collection/card screens. Build the collectible card visuals and reduced-motion reveal separately; preserve editable drafts and failure recovery.
- **D teammate:** use the same controls in profile, rating/review, pin, and title screens. Preserve zero-star versus unrated, loading/disabled saves, and accessible labels.
- **A/integrator:** maintain styling configuration, shared tokens, component contracts, and dependency/lockfile changes. Integrate backend work in its separate PR.

## Review and phone checks

The development-only `/ui-preview` route exercises the new controls without requiring a signed-in account. Open it through the running Expo app's development link. It is disabled in production.

Before merging UI features, run `npm test` and `npm run build`, then check on the iPhone: system light/dark appearance, large text, long labels, button press feedback, loading/disabled controls, and typing with the keyboard visible. Keep screenshot evidence and report any checks that could not be run. Exporting an iOS bundle verifies bundling, not physical-device appearance.

The Reusables CLI doctor currently warns that CSS color declarations are missing. Our color variables are supplied through NativeWind's runtime `vars()` bridge in the root layout, including portal content, rather than duplicated in `global.css`. The warning is a static check; keep the runtime bridge when adding components.

The setup was independently reviewed before integration. Verification on 2026-10-10: clean root `npm ci`, 18 existing tests, full typecheck/build, Expo Doctor 21/21, and iOS Hermes plus web exports passed. The new light/dark link and primary-button color pairs were checked for normal-text contrast. Physical iPhone appearance, VoiceOver, large-text layout, keyboard behavior, and touch interactions remain to be verified; no device QA is implied by the exports.

References: [React Native Reusables setup](https://reactnativereusables.com/docs/installation/manual), [NativeWind setup](https://www.nativewind.dev/docs/getting-started/installation), and the repository's Expo design-system/native UI skills.
