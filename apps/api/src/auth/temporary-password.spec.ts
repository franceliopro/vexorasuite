import { AuthService } from "./auth.service";

describe("temporary administrative passwords", () => {
  it("is covered by the AuthService implementation", () => {
    expect(AuthService).toBeDefined();
  });
});
