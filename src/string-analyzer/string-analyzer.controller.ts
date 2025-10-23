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
    return await this.service.analyzeAndSave(value);
  }

  @Get('filter-by-natural-language')
  async filterByNaturalLanguage(@Query('query') query: string) {
    // ✅ Validate presence of query
    if (!query || query.trim() === '') {
      throw new BadRequestException('Query parameter is required');
    }

    try {
      // Normalize and parse the natural language query
      const parsedFilters = this.service.parseNaturalQuery(query.toLowerCase());

      // ✅ Case 1: Unable to parse the natural language query (empty or invalid)
      if (!parsedFilters || Object.keys(parsedFilters).length === 0) {
        throw new BadRequestException('Unable to parse natural language query');
      }

      // ✅ Fetch results using parsed filters
      const data = await this.service.getAllWithFilters(parsedFilters);

      // ✅ Case 2: Query parsed but resulted in conflicting filters or invalid data
      if (!data || data.length === 0) {
        throw new UnprocessableEntityException(
          'Query parsed but resulted in conflicting filters',
        );
      }

      // ✅ Success response
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
      // Re-throw known application exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof UnprocessableEntityException
      ) {
        throw error;
      }

      // Catch unexpected errors gracefully
      console.error('Error in filterByNaturalLanguage:', error);
      throw new UnprocessableEntityException(
        'Query parsed but resulted in conflicting filters',
      );
    }
  }

  @Get(':value')
  async getAnalysis(@Param('value') value: string) {
    return await this.service.getbyValue(value);
  }

  @Get()
  async getAllAnalyses(
    @Query('is_palindrome') is_palindrome: string,
    @Query('min_length') min_length: string,
    @Query('max_length') max_length: string,
    @Query('word_count') word_count: string,
    @Query('contains_character') contains_character: string,
  ) {
    const filters: {
      is_palindrome?: boolean;
      min_length?: number;
      max_length?: number;
      word_count?: number;
      contains_character?: string;
    } = {};

    try {
      // Validate is_palindrome
      if (is_palindrome !== undefined) {
        if (is_palindrome !== 'true' && is_palindrome !== 'false') {
          throw new Error();
        }
        filters.is_palindrome = is_palindrome === 'true';
      }

      // Validate numeric fields
      const numericParams = [
        { key: 'min_length', value: min_length },
        { key: 'max_length', value: max_length },
        { key: 'word_count', value: word_count },
      ];

      for (const param of numericParams) {
        if (param.value !== undefined) {
          const num = Number(param.value);
          if (isNaN(num) || num < 0) throw new Error();
          filters[param.key] = num;
        }
      }

      // Validate contains_character (must be single char)
      if (contains_character !== undefined) {
        if (
          typeof contains_character !== 'string' ||
          contains_character.length !== 1
        ) {
          throw new Error();
        }
        filters.contains_character = contains_character.toLowerCase();
      }
    } catch {
      throw new BadRequestException('Invalid query parameter values or types');
    }

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
