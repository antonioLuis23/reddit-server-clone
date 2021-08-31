import { MikroORM } from "@mikro-orm/core";
import "reflect-metadata";
import { __prod__ } from "./constants";
import microConfig from "./mikro-orm.config";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import "dotenv/config";
// import redis from "redis";
const promiseRedis = require("promise-redis")();
const httpHeadersPlugin = require("apollo-server-plugin-http-headers");

const main = async () => {
  const orm = await MikroORM.init(microConfig);
  orm.getMigrator().up();

  const app = express();

  const redisClient = await promiseRedis.createClient();

  // se não dar certo descomentar linhas: origin: new RegExp("/*/"),
  // app.use(cors({ origin: "http://localhost:3000", credentials: true }));

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    plugins: [httpHeadersPlugin],
    context: ({ req, res }) => ({
      redisClient,
      em: orm.em,
      req,
      res,
      setCookies: new Array(),
      setHeaders: new Array(),
    }),
  });
  await apolloServer.start();
  apolloServer.applyMiddleware({
    app,
    cors: {
      credentials: true,

      origin: new RegExp("/*/"),
      allowedHeaders: ["Content-Type", "Authorization"],
    },
  });

  app.listen(4000, () => {
    console.log("server started on localhost:4000");
  });
};

main().catch((err) => {
  console.error(err);
});
