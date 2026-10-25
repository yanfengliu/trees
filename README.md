# trees

A procedurally generated low-poly cherry blossom tree on a grassy hill, swaying in the wind under a sky that follows the time of day. Every tree is grown from a seed, so the same settings always grow the same tree.

## Run it

```sh
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Controls

| Input | Action |
| --- | --- |
| W A S D or arrow keys | Move (along the ground, relative to where you look) |
| Space or E | Rise |
| Q or C | Sink |
| Hold Shift | Move faster |
| Left-drag | Look around |
| Mouse wheel | Move forward or back along the view |

The panel in the top-right corner sets the seed (or "New tree" for a random one), age, blossom density, time of day (tick "Cycle day" to let the sun move on its own, a full day in 3 minutes) and wind. The settings live in the URL, for example `?seed=42&age=0.8&time=18.5&wind=0.3&leaves=1`, so reloading or sharing the link keeps the tree.

## Development

`npm run build`, `npm test` and `npm run shots` are the gates; see [AGENTS.md](AGENTS.md).
