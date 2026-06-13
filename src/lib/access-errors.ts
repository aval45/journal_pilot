export class AccessDeniedError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AccessDeniedError";
  }
}
