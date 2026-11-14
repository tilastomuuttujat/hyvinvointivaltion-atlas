<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Neon access remains exclusively behind the existing Lovable connector gateway in server functions; the browser never touches Neon directly and credentials stay server-side.
- The visual experience reads the supplied versioned static snapshot through atlas.static; keep the existing Neon readers unchanged and connect semantic navigation to globe conclusions only through explicit current, non-rejected bridges, never text similarity.
- AtlasExperience uses one persistent AtlasSphere terrain; zoom reveals recorded map labels at fixed spherical coordinates without switching semantic scenes or resetting the camera, with anchored delta-normalized touch/trackpad gestures and no inferred evidence links.
- The GitHub Pages build serves both readers from one bundle: src/pages.tsx picks the mounted page from the URL path and vite.pages.config.ts copies the built entry into the article page's own subdirectory with its own head, because the Pages checks look for a single index-*.js chunk and a second entry point would break them.
- Teemaverkko places the theme constellations on a 3D sphere around the central star (orbit math in src/lib/teema.camera.ts, plain SVG projection); one-finger drag rotates, pinch zooms, and the globe can overlay a theme only as catalogue-membership arcs between its conclusions, never as causal claims.
- The organic node network (☍ Solmuverkko) lays out the theme catalogue with a deterministic 3D force simulation in src/lib/atlas.force-graph.ts; edges are only recorded theme membership and catalogued mechanisms, never similarity, so positions show connectivity, not effect size.
