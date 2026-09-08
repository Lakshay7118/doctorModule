const target = process.env.TEST_DATABASE_URL;
if (!target) throw new Error("TEST_DATABASE_URL must name an isolated local qlyno_hms_test database");
const parsed = new URL(target);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !/^\/qlyno_hms_test(?:_[a-z0-9_]+)?$/.test(parsed.pathname)) throw new Error("Integration tests require an isolated local qlyno_hms_test database");
require("../setup-env");
process.env.DATABASE_URL = target;
process.env.DIRECT_URL = target;
process.env.AUTH_DISABLED = "false";
