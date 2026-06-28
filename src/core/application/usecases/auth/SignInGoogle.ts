import { AuthPort, AuthProfile } from "../../ports/AuthPort";

export class SignInGoogle {
  constructor(private readonly auth: AuthPort) {}

  async execute(): Promise<AuthProfile> {
    return this.auth.signIn();
  }
}
