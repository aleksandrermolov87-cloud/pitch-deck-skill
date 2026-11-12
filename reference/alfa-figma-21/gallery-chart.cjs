// Read the existing nativeChart contract and adapt its categories and series for the Figma frame.
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const roots = [path.resolve(__dirname, "../.."), process.env.SKILL,
  path.join(require("node:os").homedir(), ".codex/skills/pitch-deck-skill")].filter(Boolean);
const moduleName = "templates/deck-starter/kit/charts.js";
const root = roots.find(dir => existsSync(path.join(dir, moduleName)));
if (!root) throw new Error("Set SKILL to the pitch-deck-skill directory");
const { nativeChart } = require(path.join(root, moduleName));
const { box, data } = JSON.parse(readFileSync(0, "utf8"));
const [chart] = nativeChart({ x: box[0]/72, y: box[1]/72, w: box[2]/72, h: box[3]/72 }, data);
process.stdout.write(JSON.stringify(chart.sheet));
