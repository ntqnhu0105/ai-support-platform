import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTicketDto {
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  subject!: string;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  body!: string;
}