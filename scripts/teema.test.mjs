import { test } from "node:test";
import assert from "node:assert/strict";
import { zoomStarCamera } from "../src/lib/teema.camera.ts";
test("pinch zoom keeps its map anchor", () => {
 const c = { x:120,y:-80,zoom:1.5 }, a={x:650,y:370};
 const n=zoomStarCamera(c,3,a);
 assert.equal((a.x-n.x)/n.zoom,(a.x-c.x)/c.zoom);
 assert.equal((a.y-n.y)/n.zoom,(a.y-c.y)/c.zoom);
});
