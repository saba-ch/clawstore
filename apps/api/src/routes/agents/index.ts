import { Hono } from "hono";
import search from "./search";
import detail from "./detail";
import publish from "./publish";
import versions from "./versions";
import reviews from "./reviews";
import type { AppEnv } from "../../types";

const app = new Hono<AppEnv>();

app.route("/", search);
app.route("/", detail);
app.route("/", publish);
app.route("/", versions);
app.route("/", reviews);

export default app;
