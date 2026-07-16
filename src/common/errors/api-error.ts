import httpStatus from 'http-status';

/**
 * Class representing an API error.
 * @extends Error
 */
export default class APIError extends Error {
  public status: number;
  public isPublic: boolean;

  constructor(
    message: string,
    status: number = httpStatus.INTERNAL_SERVER_ERROR as number,
    isPublic: boolean = false,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.isPublic = isPublic;
  }
}
