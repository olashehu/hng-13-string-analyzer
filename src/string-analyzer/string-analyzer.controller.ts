import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Param,
  HttpCode,
  Query,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { StringAnalyzerService } from './string-analyzer.service';

@Controller('strings')
export class StringAnalyzerController {
  constructor(private readonly service: StringAnalyzerService) {}

  @Post()
  async analyze(@Body('value') value: string) {
    const result = await this.service.analyzeAndSave(value);
    return {
      id: result.id,
      value: result.value,
      properties: result.properties,
      created_at: result.created_at,
    };
  }

  @Get('filter-by-natural-language')
  async filterByNaturalLanguage(@Query('query') query: string) {
    console.log('Hello from getAllAnalyses');
    console.log('Received query:', query);
    if (!query || query.trim() === '') {
      throw new BadRequestException('Query parameter is required');
    }
    try {
      console.log('Parsing natural language query:');
      const parsedFilters = this.service.parseNaturalQuery(query.toLowerCase());

      if (!parsedFilters || Object.keys(parsedFilters).length === 0) {
        throw new BadRequestException('Unable to parse natural language query');
      }
      const data = await this.service.getAllWithFilters(parsedFilters);
      return {
        data: data.map((d) => ({
          id: d.id,
          value: d.value,
          properties: d.properties,
          created_at: d.created_at,
        })),
        count: data.length,
        interpreted_query: {
          original: query,
          parsed_filters: parsedFilters,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new UnprocessableEntityException(
        'Query parsed but invalid filters',
      );
    }
  }

  @Get(':value')
  async getAnalysis(@Param('value') value: string) {
    const result = await this.service.getbyValue(value);
    return {
      id: result?.id,
      value: result?.value,
      properties: result?.properties,
      created_at: result?.created_at,
    };
  }

  @Get()
  async getAllAnalyses(
    @Query('is_palindrome') is_palindrome: string,
    @Query('min_length') min_length: string,
    @Query('max_length') max_length: string,
    @Query('word_count') word_count: string,
    @Query('contains_character') contains_character: string,
  ) {
    const filters = {
      is_palindrome:
        is_palindrome !== undefined ? is_palindrome === 'true' : undefined,
      min_length: min_length ? Number(min_length) : undefined,
      max_length: max_length ? Number(max_length) : undefined,
      word_count: word_count ? Number(word_count) : undefined,
      contains_character: contains_character || undefined,
    };

    const data = await this.service.getAllWithFilters(filters);

    if (!data || data.length === 0) {
      throw new NotFoundException('String does not exist in the system');
    }
    return {
      data: data.map((result) => ({
        id: result.id,
        value: result.value,
        properties: result.properties,
        created_at: result.created_at,
      })),
      count: data.length,
      filters_applied: {
        ...Object.fromEntries(
          Object.entries(filters).filter(([, v]) => v !== undefined),
        ),
      },
    };
  }

  @Delete(':value')
  @HttpCode(204)
  async deleteAnalysis(@Param('value') value: string) {
    await this.service.deleteByValue(value);
    return;
  }
}
