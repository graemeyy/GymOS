import { describe, expect, it } from "vitest";
import { gym as serverConfig } from "./index";
import { gym as clientConfig } from "./client";

describe("the browser's gym config", () => {
  it("is exactly what the server validates", () => {
    expect(clientConfig).toEqual(serverConfig);
  });
});
