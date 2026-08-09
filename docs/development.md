# Local backend development

Use the project-local development command:

```bash
npm run dev
```

The command runs `nodemon` and watches `src/**/*.ts` and JSON files. Nodemon restarts the TypeScript entrypoint through `tsx` when source files change. Nodemon is intentionally installed as a development dependency only.

Production does not use Nodemon. Production should build with `npm run build` and start the compiled server with `npm start`.
