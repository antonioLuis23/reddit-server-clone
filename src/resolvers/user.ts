import { User } from "../entities/User";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import argon2 from "argon2";
import { MyContext } from "../types";
@InputType()
class UsernamePasswordInput {
  @Field()
  username: string;
  @Field()
  password: string;
}

@ObjectType()
class FieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field({ nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async me(@Ctx() { redisClient, req, em }: MyContext) {
    if (!req.headers.cookie) return null;

    const userId = req.headers.cookie.slice(4);
    const storedUserId = await redisClient.get("qid");

    if (userId !== storedUserId) return null;

    const user = await em.findOne(User, { id: userId });
    return user;
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { em, redisClient, setCookies }: MyContext
  ): Promise<UserResponse> {
    if (options.username.length <= 2) {
      return {
        errors: [
          {
            field: "username",
            message: "length must be greater than 2",
          },
        ],
      };
    }

    if (options.password.length <= 3) {
      return {
        errors: [
          {
            field: "password",
            message: "length must be greater than 3",
          },
        ],
      };
    }

    const searched = await em.findOne(User, { username: options.username });
    if (searched) {
      return {
        errors: [
          {
            field: "username",
            message: "This username already exists.",
          },
        ],
      };
    }

    const hashedPassword = await argon2.hash(options.password);
    const user = em.create(User, {
      username: options.username,
      password: hashedPassword,
    });
    await em.persistAndFlush(user);

    const idName = "qid";
    redisClient.set(idName, user.id);
    setCookies.push({
      name: idName,
      value: user.id,
      options: {
        expires: new Date("2025-12-12T00:00:00"),
        httpOnly: true,
        maxAge: 3600,
        path: "/",
        sameSite: "none",
        secure: true,
      },
    });

    return { user };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { redisClient, em, setCookies }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, { username: options.username });
    if (!user) {
      return {
        errors: [
          {
            field: "username",
            message: "That username doesn't exist",
          },
        ],
      };
    }

    const valid = await argon2.verify(user.password, options.password);
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "incorrect password",
          },
        ],
      };
    }
    const idName = "qid";
    redisClient.set(idName, user.id);
    setCookies.push({
      name: idName,
      value: user.id,
      options: {
        expires: new Date("2025-12-12T00:00:00"),
        httpOnly: true,
        maxAge: 3600,
        path: "/",
        sameSite: "none",
        secure: true,
      },
    });
    //req.session.userId = user.id;
    // console.log("res.session", req.session);

    // res.cookie("name", "tobi", {
    //   maxAge: 1000 * 60 * 60 * 24 * 365 * 10, //10 years
    //   httpOnly: true,
    //   path: "/",
    //   sameSite: "none",
    //   secure: false, //cookie only works in https
    // });

    return { user };
  }
}
