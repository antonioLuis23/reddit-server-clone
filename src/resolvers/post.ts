import { Post } from "../entities/Post";
import {
  Arg,
  Field,
  Mutation,
  Query,
  Resolver,
  InputType,
  Ctx,
  UseMiddleware,
  Int,
  FieldResolver,
  Root,
  ObjectType,
} from "type-graphql";
import { MyContext } from "../types";
import { COOKIE_NAME } from "../constants";
import { isAuth } from "../middleware/isAuth";
import { getConnection } from "typeorm";
import { Updoot } from "../entities/Updoot";

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];
  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 100) + "...";
  }

  @Mutation(()=> Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg("postId", ()=> Int) postId: number,
    @Arg("value", ()=> Int) value: number,
    @Ctx() {redis}: MyContext
  ){
    value = value !==-1?1:-1;
    const userId = parseInt(await redis.get(COOKIE_NAME) as string) ;
    // await Updoot.insert({
    //   userId,
    //   postId,
    //   value,
    // });
    await getConnection().query(`
      START TRANSACTION;
      insert into updoot ("userId", "postId", value) 
      values (${userId}, ${postId}, ${value});
      update post 
      set points = points + ${value}
      where id = ${postId};
      COMMIT;
    `);

    return true;
  }

  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);
    const realLimitPlusOne = realLimit + 1;
    const replacements: any[] = [realLimitPlusOne];
    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
    }
    const posts = await getConnection().query(
      `
      select p.*, 
      json_build_object(
        'id', u.id,
        'username', u.username,
        'email', u.email,
        'createdAt', u."createdAt",
        'updatedAt', u."updatedAt"
      ) as creator
      from post p 
      inner join public.user u on u.id = p."creatorId"
      ${cursor ? `where p."createdAt"<$2` : ""}
      order by p."createdAt" DESC
      limit $1

    `,
      replacements
    );

    // const qb = getConnection()
    //   .getRepository(Post)
    //   .createQueryBuilder("p")
    //   .innerJoinAndSelect("p.creator", "u", 'u.id = p."creatorId"')
    //   .orderBy('p."createdAt"', "DESC")
    //   .take(realLimitPlusOne);
    // if (cursor) {
    //   qb.where('p."createdAt" < :cursor', {
    //     cursor: new Date(parseInt(cursor)),
    //   });
    // }

    // const posts = await qb.getMany();

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimitPlusOne,
    };
  }

  @Query(() => Post, { nullable: true })
  post(@Arg("id") id: number): Promise<Post | undefined> {
    return Post.findOne(id);
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { redis }: MyContext
  ): Promise<Post> {
    const userId = await redis.get(COOKIE_NAME);

    return Post.create({
      ...input,
      creatorId: parseInt(userId as string),
    }).save();
  }

  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg("id") id: number,
    @Arg("title", () => String, { nullable: true }) title: string
  ): Promise<Post | null> {
    const post = await Post.findOne(id);
    if (!post) {
      return null;
    }
    if (typeof title !== "undefined") {
      Post.update({ id }, { title });
    }
    return post;
  }

  @Mutation(() => Boolean)
  async deletePost(@Arg("id") id: number): Promise<boolean> {
    await Post.delete(id);
    return true;
  }
}
