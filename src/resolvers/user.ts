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
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/sendEmail";
import { v4 } from "uuid";
import { getConnection } from "typeorm";

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
  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { redis, setCookies }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length <= 3) {
      return {
        errors: [
          {
            field: "newPassword",
            message: "length must be greater than 3",
          },
        ],
      };
    }

    const key = FORGET_PASSWORD_PREFIX + token;

    const userId = await redis.get(key);
    if (!userId) {
      return {
        errors: [
          {
            field: "token",
            message: "token expired",
          },
        ],
      };
    }

    const userIdNum = parseInt(userId);
    let user = await User.findOne(userIdNum);
    if (!user) {
      return {
        errors: [
          {
            field: "token",
            message: "user no longer exists",
          },
        ],
      };
    }
    await User.update(
      { id: userIdNum },
      { password: await argon2.hash(newPassword) }
    );

    await redis.del(key);
    await redis.set(COOKIE_NAME, user.id);
    setCookies.push({
      name: COOKIE_NAME,
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

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() { redis }: MyContext
  ) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      //the email is not in the db
      return true;
    }
    const token = v4();
    await redis.set(
      FORGET_PASSWORD_PREFIX + token,
      user.id,
      "ex",
      1000 * 60 * 60 * 24 * 3
    ); // 3 days

    sendEmail(
      email,
      `<a href='http://localhost:3000/change-password/${token}'>Reset Password</a>`
    );
    return true;
  }

  @Query(() => User, { nullable: true })
  async me(@Ctx() { redis, req }: MyContext) {
    if (!req.headers.cookie) return null;

    const userId = req.headers.cookie.slice(4);
    const storedUserId = await redis.get(COOKIE_NAME);

    if (userId !== storedUserId) return null;

    return User.findOne(userId);
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { redis, setCookies }: MyContext
  ): Promise<UserResponse> {
    const errors = await validateRegister(options);
    if (errors) {
      return { errors };
    }

    const hashedPassword = await argon2.hash(options.password);

    let user;
    try {
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          username: options.username,
          email: options.email,
          password: hashedPassword,
        })
        .returning("*")
        .execute();
      user = result.raw[0];
    } catch (err) {
      console.log("err:", err);
    }

    const idName = COOKIE_NAME;
    redis.set(idName, user.id);
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
    @Ctx() { redis, setCookies }: MyContext
  ): Promise<UserResponse> {
    const user = await User.findOne(
      usernameOrEmail.includes("@")
        ? { where: { email: usernameOrEmail } }
        : { where: { username: usernameOrEmail } }
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
    redis.set(idName, user.id);
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
  async logout(@Ctx() { redis, setCookies }: MyContext) {
    const result = await redis.del(COOKIE_NAME);
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
