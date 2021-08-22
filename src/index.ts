import { MikroORM } from "@mikro-orm/core";
import "reflect-metadata";
import { __prod__ } from "./constants";
import microConfig from "./mikro-orm.config";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { Post } from "./entities/Post";
import { UserResolver } from "./resolvers/user";
import "dotenv/config";

const main = async () => {
  console.log(".env:?:::::", process.env.DB_USER);
  const orm = await MikroORM.init(microConfig);
  orm.getMigrator().up();

  const post = orm.em.create(Post, { title: "my third post" });
  orm.em.persistAndFlush(post);
  const app = express();
  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: () => ({ em: orm.em }),
  });
  await apolloServer.start();
  apolloServer.applyMiddleware({ app });

  app.listen(4000, () => {
    console.log("server started on localhost:4000");
  });
};

main().catch((err) => {
  console.error(err);
});
