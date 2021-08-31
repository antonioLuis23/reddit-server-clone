import { EntityManager, IDatabaseDriver, Connection } from "@mikro-orm/core";
import { User } from "../entities/User";
import { UsernamePasswordInput } from "../resolvers/UsernamePasswordInput";

export const validateRegister = async (
  options: UsernamePasswordInput,
  em: EntityManager<IDatabaseDriver<Connection>>
) => {
  console.log("options:::::", options);
  if (!options.email.includes("@")) {
    return [
      {
        field: "email",
        message: "Invalid email",
      },
    ];
  }

  if (options.username.length <= 2) {
    return [
      {
        field: "username",
        message: "length must be greater than 2",
      },
    ];
  }

  if (options.username.includes("@")) {
    return [
      {
        field: "username",
        message: "cannot include an @",
      },
    ];
  }

  if (options.password.length <= 3) {
    return [
      {
        field: "password",
        message: "length must be greater than 3",
      },
    ];
  }

  const searched = await em.findOne(User, { username: options.username });
  if (searched) {
    return [
      {
        field: "username",
        message: "This username already exists.",
      },
    ];
  }
  return null;
};
