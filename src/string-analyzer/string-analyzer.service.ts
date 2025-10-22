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

    // palindromic
    if (query.includes('palindromic') || query.includes('palindrome')) {
      filters.is_palindrome = true;
    }

    // single word or multi-word
    if (query.includes('single word')) {
      filters.word_count = 1;
    } else {
      const wordMatch = query.match(/(\d+)\s+words?/);
      if (wordMatch) {
        filters.word_count = parseInt(wordMatch[1], 10);
      }
    }

    // length conditions
    const longerMatch = query.match(/longer than\s+(\d+)/);
    if (longerMatch) {
      filters.min_length = parseInt(longerMatch[1], 10) + 1;
    }
    const shorterMatch = query.match(/shorter than\s+(\d+)/);
    if (shorterMatch) {
      filters.max_length = parseInt(shorterMatch[1], 10) - 1;
    }

    // contains character
    const containingLetterMatch = query.match(
      /containing the letter\s+([a-z])/,
    );
    if (containingLetterMatch) {
      filters.contains_character = containingLetterMatch[1];
    } else if (query.match(/contain(s)? the first vowel/)) {
      filters.contains_character = 'a'; // heuristic
    }

    return filters;
  }

  async analyzeAndSave(value: string): Promise<StringAnalyzer> {
    try {
      //   check if the string analyzer already exists
      const existing = await this.repo.findOne({ where: { value } });
      if (existing) {
        throw new ConflictException('String already exists in the system');
      }

      //   check if the string is empty
      if (value.trim() === '') {
        throw new BadRequestException('String value must not be empty');
      }

      // invalid data type check
      if (typeof value !== 'string') {
        throw new UnprocessableEntityException(
          'Invalid data type for value (must be string)',
        );
      }

      // Implementation of string analyzer and saving to the database
      const sha256Hash = crypto
        .createHash('sha256')
        .update(value)
        .digest('hex');

      const isPalindrome = value === value.split('').reverse().join('');
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
    } catch (error) {
      console.log('Error in analyzeAndSave:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new Error('Internal Server Error');
    }
  }

  async getbyValue(value: string): Promise<StringAnalyzer | null> {
    try {
      const result = await this.repo.findOne({ where: { value } });
      if (!result) {
        throw new NotFoundException('String analysis not found');
      }
      return {
        id: result?.id,
        value: result?.value,
        properties: result?.properties,
        created_at: result?.created_at,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Internal Server Error');
    }
  }

  async deleteByValue(value: string): Promise<void> {
    try {
      const stringAnalyzer = await this.repo.findOne({ where: { value } });
      if (!stringAnalyzer) {
        throw new NotFoundException('String does not exist in the system');
      }
      await this.repo.remove(stringAnalyzer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.log('Error in deleteByValue:', error);
      throw new Error('Internal Server Error');
    }
  }

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
        query = query.andWhere("s.properties ->> 'is_palindrome' = :ispal", {
          ispal: filters.is_palindrome ? 'true' : 'false',
        });
      }

      if (filters.min_length !== undefined) {
        query = query.andWhere(
          "CAST(s.properties ->> 'length' AS INTEGER) >= :min_length",
          { min_length: filters.min_length },
        );
      }

      if (filters.max_length !== undefined) {
        query = query.andWhere(
          "CAST(s.properties ->> 'length' AS INTEGER) <= :max_length",
          { max_length: filters.max_length },
        );
      }

      if (filters.word_count !== undefined) {
        query = query.andWhere(
          "CAST(s.properties ->> 'word_count' AS INTEGER) = :word_count",
          { word_count: filters.word_count },
        );
      }

      if (filters.contains_character !== undefined) {
        query = query.andWhere(
          "s.properties -> 'character_frequency_map' ? :contains_character",
          { contains_character: filters.contains_character },
        );
      }

      return query.getMany();
    } catch (error) {
      console.error('Error in getAllWithFilters:', error);
      throw new Error('Internal Server Error');
    }
  }
}
