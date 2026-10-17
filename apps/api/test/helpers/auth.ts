import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { createAuthOptions } from "../../src/auth";

const testAuth = betterAuth({ ...createAuthOptions(env), plugins: [testUtils()] });

/** ユーザーを作ってログインし、そのユーザーとしてリクエストするためのヘッダーを返す。 */
export const signInAsNewUser = async (overrides: { name?: string; email?: string } = {}) => {
  const { test } = await testAuth.$context;
  const user = await test.saveUser(test.createUser(overrides));
  const { headers } = await test.login({ userId: user.id });
  return { user, headers };
};
