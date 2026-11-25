// U06 Diatonic Harmony, lessons 7–12 in the real app, every step of every lesson from a dev seed (see w4walk.ts and walk.ts).
// U07.L01 is walked here, after U06.L12. Since Oak 2.0 W2 U06.L13 sits between them in the default order, so U07.L01
// seeds its own point (`after U06.L13`) instead of chaining from the test before it (chain.ts).
import { walkSuite } from "./w4walk.ts";

walkSuite(["U06.L07", "U06.L08", "U06.L09", "U06.L10", "U06.L11", "U06.L12", "U07.L01"]);
