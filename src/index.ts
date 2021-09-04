import "reflect-metadata";
import { __prod__ } from "./constants";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import ioRedis from "ioredis";
import "dotenv/config";
import { createConnection } from "typeorm";
import { Post } from "./entities/Post";
import { User } from "./entities/User";
import path from "path";
import { Updoot } from "./entities/Updoot";
// import redis from "redis";
//const promiseRedis = require("promise-redis")();

const httpHeadersPlugin = require("apollo-server-plugin-http-headers");
const main = async () => {
  const conn = await createConnection({
    type: "postgres",
    database: "lireddit2",
    username: "postgres",
    password: "postgres",
    logging: true,
    synchronize: true,
    migrations: [path.join(__dirname, "./migrations/*")],
    entities: [Post, User, Updoot],
  });
  //await conn.runMigrations();
  //await Post.delete({});
  console.log("aaa");
  const app = express();

  //const redis = await promiseRedis.createClient();
  const redis = new ioRedis();

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    plugins: [httpHeadersPlugin],
    context: ({ req, res }) => ({
      redis,
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
