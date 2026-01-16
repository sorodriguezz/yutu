import crypto from "node:crypto";

export const makeId = () => crypto.randomUUID();
