export interface Kanji {
  kanji: string;
  grade: number;
  stroke_count: number;
  meanings: string[];
  kun_readings: string[];
  on_readings: string[];
  freq: number;
  level: number;
  jlpt: number;
}

export interface KanjiProgress {
  learned: boolean;
  lastReviewed?: string;
}

export interface KanjiWithProgress extends Kanji {
  progress?: KanjiProgress;
}
