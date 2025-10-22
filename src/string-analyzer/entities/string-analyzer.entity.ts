import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('string_analyzer')
export class StringAnalyzer {
  @PrimaryColumn()
  id: string; // sha256 hash

  @Column()
  value: string;

  @Column({ type: 'jsonb' })
  properties: {
    length: number;
    is_palindrome: boolean;
    unique_characters: number;
    word_count: number;
    sha256_hash: string;
    character_frequency_map: Record<string, number>;
  };

  @CreateDateColumn()
  created_at: Date;
}
