import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SoilProfile } from './entities/soil-profile.entity';
import { SoilService } from './soil.service';
import { SoilController } from './soil.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SoilProfile])],
  controllers: [SoilController],
  providers: [SoilService],
  exports: [TypeOrmModule, SoilService],
})
export class SoilModule {}
