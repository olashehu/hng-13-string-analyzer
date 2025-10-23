import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Param,
  HttpCode,
  Query,
  //   NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { StringAnalyzerService } from './string-analyzer.service';

@Controller('strings')
export class StringAnalyzerController {
  constructor(private readonly service: StringAnalyzerService) {}

  /**
   * POST /strings
   * - 201 Created on success
   * - 400 Bad Request if missing 'value'
   * - 422 Unprocessable Entity if wrong data type
   * - 409 Conflict if duplicate
   */
  @Post()
  @HttpCode(201)
  async analyze(@Body('value') value: unknown) {
    // missing 'value'
    if (typeof value === 'undefined') {
      throw new BadRequestException(
        'Invalid request body or missing "value" field',
      );
    }

    // validate type
    if (typeof value !== 'string') {
      throw new UnprocessableEntityException(
        'Invalid data type for value (must be string)',
      );
    }

    try {
      const created = await this.service.analyzeAndSave(value);
      return created; // 201 due to @HttpCode
    } catch (err) {
      // rethrow known exceptions so nest converts to correct status code
      if (
        err instanceof BadRequestException ||
        err instanceof ConflictException ||
        err instanceof UnprocessableEntityException
      ) {
        throw err;
      }
      // unexpected
      console.error('POST /strings error:', err);
      throw new UnprocessableEntityException('Internal Server Error');
    }
  }

  /**
   * Natural language endpoint:
   * - 400 if unable to parse
   * - 422 if parsed but filters conflict (parse method throws UnprocessableEntityException)
   * - 200 with results (can be empty) otherwise
   */
  @Get('filter-by-natural-language')
  async filterByNaturalLanguage(@Query('query') query?: string) {
    if (!query || query.trim() === '') {
      throw new BadRequestException('Query parameter is required');
    }

    // parseNaturalQuery may throw UnprocessableEntityException for conflicts
    type NLFilters = {
      is_palindrome?: boolean;
      min_length?: number;
      max_length?: number;
      word_count?: number;
      contains_character?: string;
      [key: string]: unknown;
    };

    let parsedFilters: NLFilters | null = null;
    try {
      parsedFilters = this.service.parseNaturalQuery(
        query.toLowerCase().trim(),
      ) as NLFilters;
    } catch (err) {
      if (err instanceof UnprocessableEntityException) throw err; // 422
      throw new BadRequestException('Unable to parse natural language query'); // 400
    }

    if (!parsedFilters || Object.keys(parsedFilters).length === 0) {
      throw new BadRequestException('Unable to parse natural language query');
    }

    // fetch results (returns [] when none)
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
  }

  /**
   * GET /strings/:value -> 200 with object or 404 if not found
   */
  @Get(':value')
  async getAnalysis(@Param('value') value: string) {
    return await this.service.getbyValue(value); // service throws NotFoundException if missing
  }

  /**
   * GET /strings (filters via query params)
   * - 400 when any query param has wrong type/format (message: "Invalid query parameter values or types")
   * - 200 with data (empty array allowed)
   */
  @Get()
  async getAllAnalyses(
    @Query('is_palindrome') is_palindrome?: string,
    @Query('min_length') min_length?: string,
    @Query('max_length') max_length?: string,
    @Query('word_count') word_count?: string,
    @Query('contains_character') contains_character?: string,
  ) {
    const filters: {
      is_palindrome?: boolean;
      min_length?: number;
      max_length?: number;
      word_count?: number;
      contains_character?: string;
    } = {};

    try {
      // is_palindrome -> must be 'true' or 'false' if provided
      if (typeof is_palindrome !== 'undefined') {
        if (is_palindrome !== 'true' && is_palindrome !== 'false') {
          throw new Error();
        }
        filters.is_palindrome = is_palindrome === 'true';
      }

      // numeric params: must be non-negative integers
      const numericParams: {
        key: 'min_length' | 'max_length' | 'word_count';
        value?: string;
      }[] = [
        { key: 'min_length', value: min_length },
        { key: 'max_length', value: max_length },
        { key: 'word_count', value: word_count },
      ];
      for (const param of numericParams) {
        if (typeof param.value !== 'undefined') {
          const num = Number(param.value);
          if (!Number.isFinite(num) || Number.isNaN(num) || num < 0)
            throw new Error();
          // use integer
          const key = param.key;
          filters[key] = Math.floor(num);
        }
      }

      // contains_character must be a single character if provided
      if (typeof contains_character !== 'undefined') {
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

  /**
   * DELETE /strings/:value
   * - 204 on delete
   * - 404 if not found
   */
  @Delete(':value')
  @HttpCode(204)
  async deleteAnalysis(@Param('value') value: string) {
    await this.service.deleteByValue(value); // service throws NotFoundException if missing
    return;
  }
}
