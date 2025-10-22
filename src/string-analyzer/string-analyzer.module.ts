import { Module } from '@nestjs/common';
import { StringAnalyzerService } from './string-analyzer.service';
import { StringAnalyzerController } from './string-analyzer.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StringAnalyzer } from './entities/string-analyzer.entity';

@Module({
  providers: [StringAnalyzerService],
  controllers: [StringAnalyzerController],
  imports: [TypeOrmModule.forFeature([StringAnalyzer])],
})
export class StringAnalyzerModule {}
