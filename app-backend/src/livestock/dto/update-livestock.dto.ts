import { PartialType } from '@nestjs/swagger';
import { CreateLivestockDto } from './create-livestock.dto';

export class UpdateLivestockDto extends PartialType(CreateLivestockDto) {}
