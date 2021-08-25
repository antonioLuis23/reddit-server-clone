import { EntityManager, IDatabaseDriver, Connection } from "@mikro-orm/core";
import { Request, Response } from "express";
export type MyContext = {
  redisClient: any;
  em: EntityManager<IDatabaseDriver<Connection>>;
  req: Request & any;
  res: Response;
  setCookies: any;
  setHeaders: any;
};
