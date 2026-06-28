import { AuthPort, AuthProfile } from "../../ports/AuthPort";

export class GetAuthProfile {
  constructor(private readonly auth: AuthPort) {}

  async execute(): Promise<AuthProfile | null> {
    return this.auth.getProfile();
  }
}
