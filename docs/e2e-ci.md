# E2E & CI: MuseumGlobe + Marketplace

Ce document décrit les tests E2E et la configuration CI pour:
- MuseumGlobe (Puppeteer + Axe-core)
- Marketplace (sous réserve d'ajout de tests spécifiques)

Run locally:
1. Start frontend: `npm run dev -- --port 5176`
2. Run the museum e2e: `npm run test:e2e-museum` (le test stubbe `/api/museum/globe` pour être indépendant du backend)

CI:
- Workflow `.github/workflows/e2e-museum-globe.yml` est déclenché sur PRs et publie les artefacts Axe (JSON + HTML) sous `artifacts/`.

Notes:
- Si vous ajoutez des tests e2e Marketplace, placez-les dans `scripts/` et créez une job CI équivalente pour exécuter `npm run test:e2e-marketplace`.
- Les artefacts sont disponibles dans la page d'exécution du workflow GitHub Actions.
