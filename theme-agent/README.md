# Private live AI theme service

This Cloudflare Worker powers the **Suggest themes** button in the Mont-Blanc wedding planner. It uses the OpenAI Responses API with strict structured output and returns exactly three palettes. It does not generate pretend AI responses when configuration is missing.

The frontend opens the owner-private service in a sign-in window. An origin-checked, single-request message channel returns the palettes to the original planner, where the user previews and applies them. Only the prompt, eight current colours and up to three previous theme names are sent. Guest lists, shopping lists and object placements are excluded. The API key stays in the Worker environment.

## Hosting

The dedicated Sites identity is tracked in `.openai/hosting.json`. Preserve owner-only access; the Worker also requires Sites visitor identity on inference requests. It must not be exposed as a public inference proxy. Publish through the Sites skill's source, packaging and deployment workflow.

Runtime settings:

- `OPENAI_API_KEY`: required secret. Configure using the OpenAI Developers plugin's `openai-platform-api-key` skill and its required approval, as required by the Sites secret setup workflow. Never put it in the public repository, frontend, manifest or browser storage.
- `OPENAI_MODEL`: defaults to `gpt-5-mini`.
- `PLANNER_ORIGINS`: comma-separated exact frontend origins allowed to communicate with the browser bridge. Production uses `https://laliza03.github.io`; local QA additionally uses `http://127.0.0.1:4173`.

After secret approval and successful private deployment, verify signed-in end-to-end generation and set `enabled: true` in the frontend's `ai-config.json`. Until then, the frontend honestly shows activation pending and leaves ready-made palettes available.

## Checks

```sh
npm test
npm run build
npm run validate
```

Tests mock the upstream model and do not spend API credits. They verify authentication, origin checks, missing-key errors, prompt bounds, data minimization, schema validation, upstream errors and secret-free bridge responses. Live model generation still requires a configured account and a signed-in browser check. The private service remains separate from the static GitHub Pages deployment.
