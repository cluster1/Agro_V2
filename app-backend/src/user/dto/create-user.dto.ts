import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { USER_ROLES } from '../../common/constants/roles';

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  user_name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  user_email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(72)
  user_pass: string;

  @ApiProperty({ example: '+62812345678', required: false })
  @IsString()
  @IsOptional()
  user_phone?: string;

  @ApiProperty({ example: 'operator', description: 'admin (global, requires user_level 0) / tenant_admin / operator / agronom' })
  @IsString()
  @IsIn(USER_ROLES)
  user_role: string;

  @ApiProperty({ example: 2, description: '0 = global admin, 1 = tenant admin, 2 = operator, 3 = agronom' })
  @IsInt()
  @Min(0)
  @Max(3)
  @IsOptional()
  user_level?: number;

  @ApiProperty({ example: 'active', required: false })
  @IsString()
  @IsOptional()
  user_sts?: string;
}
