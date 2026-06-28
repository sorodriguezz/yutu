import { AuthPort } from "../../ports/AuthPort";

export class SignOutGoogle {
  constructor(private readonly auth: AuthPort) {}

  async execute(): Promise<void> {
    return this.auth.signOut();
  }
}
