import { MyContext } from "../types";
import { MiddlewareFn } from "type-graphql";
import { COOKIE_NAME } from "../constants";

export const isAuth: MiddlewareFn<MyContext> = async ({ context }, next) => {
  const userId = await context.redis.get(COOKIE_NAME);
  if (!userId) {
    throw new Error("not authenticated");
  }

  return next();
};
