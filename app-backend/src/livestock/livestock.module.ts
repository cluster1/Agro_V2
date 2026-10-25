import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LivestockService } from './livestock.service';
import { LivestockController } from './livestock.controller';
import { Livestock } from './entities/livestock.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Livestock])],
  controllers: [LivestockController],
  providers: [LivestockService],
  exports: [LivestockService],
})
export class LivestockModule {}
