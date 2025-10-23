/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { StringAnalyzer } from './entities/string-analyzer.entity';

@Injectable()
export class StringAnalyzerService {
  constructor(
    @InjectRepository(StringAnalyzer)
    private readonly repo: Repository<StringAnalyzer>,
  ) {}

  /**
   * Parse natural language queries into filters.
   * Throws UnprocessableEntityException if filters conflict.
   */
  parseNaturalQuery(query: string): {
    is_palindrome?: boolean;
    word_count?: number;
    min_length?: number;
    max_length?: number;
    contains_character?: string;
  } {
    const filters: {
      is_palindrome?: boolean;
      word_count?: number;
      min_length?: number;
      max_length?: number;
      contains_character?: string;
    } = {};

    // Basic keywords
    if (/palindrom/i.test(query)) {
      filters.is_palindrome = true;
    }

    if (/single word/i.test(query)) {
      filters.word_count = 1;
    } else {
      const wordMatch = query.match(/(\d+)\s+words?/i);
      if (wordMatch) filters.word_count = parseInt(wordMatch[1], 10);
    }

    const longerMatch = query.match(/(?:longer than|more than)\s+(\d+)/i);
    if (longerMatch) filters.min_length = parseInt(longerMatch[1], 10) + 1;

    const shorterMatch = query.match(/(?:shorter than|less than)\s+(\d+)/i);
    if (shorterMatch) filters.max_length = parseInt(shorterMatch[1], 10) - 1;

    // contains specific letter: "containing the letter z" or "containing z"
    const containsMatch = query.match(
      /(?:containing the letter|containing|contains)\s+([a-z])/i,
    );
    if (containsMatch)
      filters.contains_character = containsMatch[1].toLowerCase();

    // heuristic: "first vowel" -> 'a'
    if (/first vowel/i.test(query) && !filters.contains_character) {
      filters.contains_character = 'a';
    }

    // validate logical consistency
    if (
      typeof filters.min_length !== 'undefined' &&
      typeof filters.max_length !== 'undefined' &&
      filters.min_length > filters.max_length
    ) {
      throw new UnprocessableEntityException(
        'Query parsed but resulted in conflicting filters',
      );
    }

    if (filters.word_count !== undefined && filters.word_count < 0) {
      throw new UnprocessableEntityException(
        'Query parsed but resulted in conflicting filters',
      );
    }

    return filters;
  }

  /**
   * Analyze and save a string
   * - throws:
   *   - ConflictException (409) if duplicate
   *   - BadRequestException (400) if empty
   *   - UnprocessableEntityException (422) if wrong type
   */
  async analyzeAndSave(value: string): Promise<StringAnalyzer> {
    try {
      if (typeof value !== 'string') {
        throw new UnprocessableEntityException(
          'Invalid data type for value (must be string)',
        );
      }

      if (value.trim() === '') {
        throw new BadRequestException(
          'Invalid request body or missing "value" field',
        );
      }

      // compute sha256 hash of the raw value
      const sha256Hash = crypto
        .createHash('sha256')
        .update(value)
        .digest('hex');

      // check duplicate by id (hash) or by value
      const existingById = await this.repo.findOne({
        where: { id: sha256Hash },
      });
      if (existingById) {
        throw new ConflictException('String analysis already exists');
      }

      // normalized for palindrome check: remove non-alphanumeric and lower-case
      const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isPalindrome =
        normalized === normalized.split('').reverse().join('');

      const uniqueCharacters = new Set(value).size;
      const wordCount =
        value.trim() === '' ? 0 : value.trim().split(/\s+/).length;

      const characterFrequencyMap: Record<string, number> = {};
      for (const char of value) {
        characterFrequencyMap[char] = (characterFrequencyMap[char] || 0) + 1;
      }

      const properties = {
        length: value.length,
        is_palindrome: isPalindrome,
        unique_characters: uniqueCharacters,
        word_count: wordCount,
        sha256_hash: sha256Hash,
        character_frequency_map: characterFrequencyMap,
      };

      const stringAnalyzer = this.repo.create({
        id: sha256Hash,
        value,
        properties,
      });

      const result = await this.repo.save(stringAnalyzer);

      return {
        id: result.id,
        value: result.value,
        properties: result.properties,
        created_at: result.created_at,
      };
    } catch (err) {
      // rethrow known errors so controller can handle status codes
      if (
        err instanceof BadRequestException ||
        err instanceof ConflictException ||
        err instanceof UnprocessableEntityException
      ) {
        throw err;
      }
      console.error('Error in analyzeAndSave:', err);
      throw new UnprocessableEntityException('Internal Server Error');
    }
  }

  /**
   * Find by value
   * - 404 if not found
   */
  async getbyValue(value: string): Promise<StringAnalyzer> {
    try {
      const result = await this.repo.findOne({ where: { value } });
      if (!result) {
        throw new NotFoundException('String does not exist in the system');
      }
      return {
        id: result.id,
        value: result.value,
        properties: result.properties,
        created_at: result.created_at,
      };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.error('Error in getbyValue:', err);
      throw new UnprocessableEntityException('Internal Server Error');
    }
  }

  /**
   * Get all with filters (filters validated by controller)
   * returns [] when no result
   */
  async getAllWithFilters(filters: {
    is_palindrome?: boolean;
    min_length?: number;
    max_length?: number;
    word_count?: number;
    contains_character?: string;
  }): Promise<StringAnalyzer[]> {
    try {
      let query = this.repo.createQueryBuilder('s');

      if (typeof filters.is_palindrome !== 'undefined') {
        if (typeof filters.is_palindrome !== 'boolean') {
          throw new BadRequestException(
            'Invalid query parameter values or types',
          );
        }
        // compare text value 'true'/'false'
        query = query.andWhere("s.properties ->> 'is_palindrome' = :ispal", {
          ispal: filters.is_palindrome ? 'true' : 'false',
        });
      }

      if (typeof filters.min_length !== 'undefined') {
        if (typeof filters.min_length !== 'number') {
          throw new BadRequestException(
            'Invalid query parameter values or types',
          );
        }
        query = query.andWhere(
          "CAST(s.properties ->> 'length' AS INTEGER) >= :min_length",
          { min_length: filters.min_length },
        );
      }

      if (typeof filters.max_length !== 'undefined') {
        if (typeof filters.max_length !== 'number') {
          throw new BadRequestException(
            'Invalid query parameter values or types',
          );
        }
        query = query.andWhere(
          "CAST(s.properties ->> 'length' AS INTEGER) <= :max_length",
          { max_length: filters.max_length },
        );
      }

      if (typeof filters.word_count !== 'undefined') {
        if (typeof filters.word_count !== 'number') {
          throw new BadRequestException(
            'Invalid query parameter values or types',
          );
        }
        query = query.andWhere(
          "CAST(s.properties ->> 'word_count' AS INTEGER) = :word_count",
          { word_count: filters.word_count },
        );
      }

      if (typeof filters.contains_character !== 'undefined') {
        if (
          typeof filters.contains_character !== 'string' ||
          filters.contains_character.length !== 1
        ) {
          throw new BadRequestException(
            'Invalid query parameter values or types',
          );
        }
        query = query.andWhere(
          "s.properties -> 'character_frequency_map' ? :contains_character",
          { contains_character: filters.contains_character },
        );
      }

      const rows = await query.getMany();
      return rows.map((r) => ({
        id: r.id,
        value: r.value,
        properties: r.properties,
        created_at: r.created_at,
      })) as StringAnalyzer[];
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      console.error('Error in getAllWithFilters:', err);
      throw new BadRequestException('Invalid query parameter values or types');
    }
  }

  /**
   * Delete by value
   */
  async deleteByValue(value: string): Promise<void> {
    try {
      const stringAnalyzer = await this.repo.findOne({ where: { value } });
      if (!stringAnalyzer) {
        throw new NotFoundException('String does not exist in the system');
      }
      await this.repo.remove(stringAnalyzer);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.error('Error in deleteByValue:', err);
      throw new UnprocessableEntityException('Internal Server Error');
    }
  }
}
