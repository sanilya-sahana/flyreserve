# @flyreserve/web

Customer-facing booking flow shell for FlyReserve.
Delivers SAH-19 slice 1: routing skeleton, design-system baseline, and the
four booking screens wired end-to-end against placeholder data.

## Stack

Per [SAH-25 ADR](../../../SAH/issues/SAH-25#document-adr):

- React 19 + TypeScript
- Vite (build) and Vitest (unit)
- React Router (data mode) for client-side routing
- TanStack Query for server state
- Tailwind CSS for styling, Radix UI primitives for accessible controls
- React Testing Library for component tests
- Target accessibility bar: WCAG 2.1 AA

## Layout

```
apps/web
├── index.html
├── src
│   ├── main.tsx                # React root, providers
│   ├── routes/index.tsx        # createBrowserRouter map
│   ├── booking/                # Booking flow screens + layout
│   ├── design-system/          # Button, Field, ... (locally owned primitives)
│   ├── lib/cn.ts               # Tailwind-aware class name combiner
│   └── styles/globals.css      # Tailwind entry + focus/reduced-motion rules
├── tailwind.config.ts
├── vite.config.ts
├── vitest.config.ts
└── tsconfig.json
```

## Scripts

```bash
pnpm install          # or npm install
pnpm dev              # start Vite on :5173
pnpm build            # tsc -b && vite build
pnpm test             # vitest run
pnpm test:coverage    # vitest run --coverage (v8)
pnpm lint             # eslint src
pnpm typecheck        # tsc --noEmit
```

## Booking flow (shell)

Routes:

- `/booking/search`       — trip details (origin, destination, dates, passengers)
- `/booking/select`       — placeholder flight list
- `/booking/passengers`   — per-passenger name; passenger 1 is the contact
- `/booking/checkout`     — coupon input + placeholder totals + place order
- `/booking/confirmation` — post-purchase confirmation view

Live flight data, PNR generation, tax/currency computation (INR/USD), coupon
validation, and Stripe/PayPal payment mounting all depend on the OpenAPI
contract (SAH-25 ADR item 10) and the per-screen Spec (SAH-26). The shell
uses placeholder data so the flow is walkable for demo and Playwright bootstrap.

## Known open items (not owned by this workspace)

- API contract source and generated client: SAH-25 ADR item 10, follow-up
  owned by Engineering Manager / backend/API owner.
- Per-screen field/behavior specs (multi-city, cabin class, ID docs, TTL,
  coupon rules, INR/USD toggle, PNR display, download flow): SAH-26.
- CI/coverage path updates for the new workspace layout: DevOps Manager.
- E2E Playwright coverage: QA Manager.

## Accessibility notes

- `:focus-visible` outline enforced globally.
- `prefers-reduced-motion` respected (globals.css).
- Every form input goes through the shared `Field` primitive, which pairs
  labels with inputs and wires `aria-invalid` / `aria-describedby` for errors.
- Progress stepper uses `aria-current="step"` on the active step.
