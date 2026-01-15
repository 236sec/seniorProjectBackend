import { IsEmail, IsEnum, IsString } from 'class-validator';

export class LoginUserDto {
  @IsEmail()
  readonly email: string;

  @IsEnum(['google', 'github'])
  readonly provider: string;

  @IsString()
  readonly firstName: string;

  @IsString()
  readonly lastName: string;
}
