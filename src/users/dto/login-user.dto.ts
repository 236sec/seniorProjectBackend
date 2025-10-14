import { IsEmail, IsEnum } from 'class-validator';

export class LoginUserDto {
  @IsEmail()
  readonly email: string;

  @IsEnum(['google', 'github'])
  readonly provider: string;
}
