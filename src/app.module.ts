import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StringAnalyzerModule } from './string-analyzer/string-analyzer.module';
import { StringAnalyzer } from './string-analyzer/entities/string-analyzer.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [StringAnalyzer],
        // synchronize: true,
      }),
      inject: [ConfigService],
    }),
    StringAnalyzerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
