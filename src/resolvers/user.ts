import { User } from "../entities/User";
import {
  Arg,
  Ctx,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import argon2 from "argon2";
import { MyContext } from "../types";
import { COOKIE_NAME } from "../constants";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { validateRegister } from "../utils/validateRegister";
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
  @Mutation(() => Boolean)
  async forgotPassword(@Arg("email") email: string, @Ctx() { em }: MyContext) {
    const user = await em.findOne(User, { email });
    if (!user) {
      //the email is not in the db
      return true;
    }
    return true;
  }

  @Query(() => User, { nullable: true })
  async me(@Ctx() { redisClient, req, em }: MyContext) {
    if (!req.headers.cookie) return null;

    const userId = req.headers.cookie.slice(4);
    const storedUserId = await redisClient.get(COOKIE_NAME);

    if (userId !== storedUserId) return null;

    const user = await em.findOne(User, { id: userId });
    return user;
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { em, redisClient, setCookies }: MyContext
  ): Promise<UserResponse> {
    const errors = await validateRegister(options, em);
    if (errors) {
      return { errors };
    }

    const hashedPassword = await argon2.hash(options.password);
    const user = em.create(User, {
      username: options.username,
      password: hashedPassword,
      email: options.email,
    });
    await em.persistAndFlush(user);

    const idName = COOKIE_NAME;
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
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { redisClient, em, setCookies }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(
      User,
      usernameOrEmail.includes("@")
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail }
    );
    if (!user) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: "That username doesn't exist",
          },
        ],
      };
    }

    const valid = await argon2.verify(user.password, password);
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
    const idName = COOKIE_NAME;
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

  @Mutation(() => Boolean)
  async logout(@Ctx() { redisClient, setCookies }: MyContext) {
    const result = await redisClient.del(COOKIE_NAME);
    setCookies.push({
      name: COOKIE_NAME,
      value: "test",
      options: {
        expires: new Date("1970-12-12T00:00:00"),
        httpOnly: true,
        maxAge: 0,
        path: "/",
        sameSite: "none",
        secure: true,
      },
    });
    if (result === 1) {
      return true;
    } else {
      console.log("erro ao limpar o cookie");
      return false;
    }
  }
}
