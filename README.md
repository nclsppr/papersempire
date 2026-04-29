# Papers Empire

A bright, addictive idle game where you grow a tiny low-poly paper factory.
Tap to print money, unlock buildings, and watch the assembly line come alive.

## Stack

- [Vite](https://vitejs.dev/)
- [React 18](https://react.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) with `tailwindcss-animate`
- [shadcn/ui](https://ui.shadcn.com/) primitives (`Button`, `Card`, `Progress`)
- [Zustand](https://github.com/pmndrs/zustand) for the game state
- [lucide-react](https://lucide.dev/) icons

No 3D libraries — the factory is a fake-isometric scene built from divs, gradients,
and CSS transforms.

## Run locally

```bash
npm install
npm run dev
```

The dev server starts on `http://localhost:5173`.

## Build for production

```bash
npm run build
npm run preview
```

The static output lives in `dist/`.

## Project layout

```
src/
  App.tsx                  # main shell + screen routing
  main.tsx                 # React entry
  index.css                # Tailwind layers + theme tokens
  components/
    ui/                    # shadcn-style primitives
    factory/               # 2.5D low-poly factory pieces
    ResourceBar.tsx        # sticky top bar
    BottomNav.tsx          # sticky bottom navigation
  game/
    definitions.ts         # buildings, upgrades, balance numbers
    selectors.ts           # rate / cost calculations
    store.ts               # Zustand store + persistence
    types.ts
    useTick.ts             # rAF idle loop
  screens/
    FactoryScreen.tsx
    UpgradesScreen.tsx
    SettingsScreen.tsx
```

## Design system

| Token              | Value                       | Usage              |
| ------------------ | --------------------------- | ------------------ |
| Background         | off-white / soft gradients  | Page surface       |
| Card               | pure white                  | Floating panels    |
| Primary            | green (`money-500`)         | Cash, growth       |
| Secondary          | soft blue                   | Workers, secondary |
| Accent             | warm yellow (`sun-500`)     | Calls to action    |
| Foreground         | slate (`hsl(215 25% 22%)`)  | Text               |

Rules followed:

- Max 3 pieces of info per block.
- 1 primary action per screen.
- Big touch targets (>= 44px).
- Rounded everything, soft shadows, generous spacing.
- Mobile-first; the layout is centered with `max-w-2xl` / `max-w-3xl`.
