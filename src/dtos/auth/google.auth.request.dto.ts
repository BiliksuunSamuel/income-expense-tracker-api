export class GoogleAuthRequestDto {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly picture: string;
  readonly accessToken: string;
  readonly emailVerified: boolean;
  readonly fcmToken: string;
}
