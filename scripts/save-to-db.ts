import { Glob } from "bun";
import { db } from "@/lib/db";
import { Kanji, kanji, Phrase, phrases, PhraseComponent, phraseComponents } from "@/drizzle/schema";
import { exit } from "process";
import order from "./order.txt";
import kanji_data from "../data.json" assert { type: "json" };
import { sql } from "drizzle-orm";

console.log("Starting data import script...");

const BATCH_SIZE = 1000; // Define batch size for insertions

const glob = new Glob("*");
const hiragana =
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ";
const katakana =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ";
const punctuation = "・"; // Add other punctuation if needed

const kanjiToInsert: Omit<Kanji, "id">[] = [];
const phrasesToInsert: Omit<Phrase, "id">[] = [];
const componentsToInsert: Omit<PhraseComponent, "phraseId" | "kanjiId"> & { phraseName: string; kanjiChar: string }[] = [];

const get_order = (char: string): number => {
  const index = order.indexOf(char);
  return index === -1 ? 99999 : index; // Use a high number for not found
};

console.log("Scanning data files...");
const dataFiles = Array.from(glob.scanSync("./data"));
console.log(`Found ${dataFiles.length} files.`);

// --- First Pass: Collect all Kanji characters --- 
const allKanjiChars = new Set<string>();
for (const file of dataFiles) {
  const name = file.slice(0, -5);
  if (name.length === 1 && !hiragana.includes(name) && !katakana.includes(name) && !punctuation.includes(name)) {
    allKanjiChars.add(name);
  }
}
console.log(`Identified ${allKanjiChars.size} potential Kanji characters.`);

// --- Second Pass: Process Kanji and Phrases --- 
for (const file of dataFiles) {
  const filePath = `./data/${file}`;
  try {
    const filedata = Bun.file(filePath);
    const data = await filedata.json();
    const name = file.slice(0, -5);

    // Skip pure hiragana/katakana entries
    if (name.split("").every((char) => (hiragana + katakana + punctuation).includes(char))) {
      continue;
    }

    if (name.length === 1 && allKanjiChars.has(name)) {
      // Process Kanji
      const kanjiInfo = kanji_data.find((entry) => entry.kanji === name);
      if (!kanjiInfo) {
        console.warn(`Kanji info not found in data.json for: ${name}`);
        continue; 
      }
      const { stroke_count, jlpt, grade, meanings } = kanjiInfo;
      
      const readings = (data.japanese || []).map((r: any) => ({ word: r.word, reading: r.reading }));
      const definitions = [
          ...(meanings || []),
          ...(data.senses || []) 
            .map((sense: any) => sense.english_definitions)
            .flat()
            .filter((def: string | null) => def !== null),
        // Fix: Add types for index and self
        ].filter((def: string, index: number, self: string[]) => self.indexOf(def) === index); 

      kanjiToInsert.push({
        character: name,
        isCommon: data.is_common ?? false,
        readings: readings,
        definitions: definitions,
        frequency: get_order(name),
        strokeCount: stroke_count ?? data.stroke_count ?? null,
        jlptLevel: jlpt ?? null,
        grade: grade ?? null,
      });
    } else {
      // Process Phrase
      const readings = (data.japanese || []).map((r: any) => ({ word: r.word, reading: r.reading }));
      const definitions = (data.senses || [])
          .map((sense: any) => sense.english_definitions)
          .flat()
          .filter((def: string | null) => def !== null)
          // Fix: Add types for index and self
          .filter((def: string, index: number, self: string[]) => self.indexOf(def) === index); 

      phrasesToInsert.push({
        phrase: name,
        isCommon: data.is_common ?? false,
        jlptLevel: data.jlpt?.[0] ? parseInt(data.jlpt[0].replace("jlpt-n", "")) : null, 
        readings: readings,
        definitions: definitions,
      });

      // Identify constituent Kanji
      const uniqueKanjiInPhrase = new Set<string>();
      for (const char of name) {
        if (allKanjiChars.has(char)) {
           uniqueKanjiInPhrase.add(char);
        }
      }
      for (const uniqueChar of uniqueKanjiInPhrase) {
          componentsToInsert.push({ phraseName: name, kanjiChar: uniqueChar });
      }
    }
  } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
  }
}

console.log(`Prepared ${kanjiToInsert.length} Kanji entries.`);
console.log(`Prepared ${phrasesToInsert.length} Phrase entries.`);
// Log the count *before* deduplication in the next step
console.log(`Identified ${componentsToInsert.length} potential Component links.`); 

// --- Third Pass: Insert into Database --- 
try {
  console.log("Starting database transaction...");
  await db.transaction(async (tx) => {
    console.log("Deleting existing data...");
    await tx.delete(phraseComponents);
    await tx.delete(phrases);
    await tx.delete(kanji);
    console.log("Existing data deleted.");

    // Reset sequences for serial IDs
    await tx.execute(sql`ALTER SEQUENCE kanji_id_seq RESTART WITH 1;`);
    await tx.execute(sql`ALTER SEQUENCE phrases_id_seq RESTART WITH 1;`);
    console.log("Sequences reset.");

    let insertedKanji: { id: number; character: string }[] = [];
    if (kanjiToInsert.length > 0) {
      console.log("Inserting Kanji...");
      insertedKanji = await tx.insert(kanji).values(kanjiToInsert).returning({ id: kanji.id, character: kanji.character });
      console.log(`Inserted ${insertedKanji.length} Kanji.`);
    }
    const kanjiIdMap = new Map(insertedKanji.map(k => [k.character, k.id]));

    let insertedPhrases: { id: number; phrase: string }[] = [];
    if (phrasesToInsert.length > 0) {
      console.log(`Inserting ${phrasesToInsert.length} Phrases in batches of ${BATCH_SIZE}...`);
      for (let i = 0; i < phrasesToInsert.length; i += BATCH_SIZE) {
        const batch = phrasesToInsert.slice(i, i + BATCH_SIZE);
        const result = await tx.insert(phrases).values(batch).returning({ id: phrases.id, phrase: phrases.phrase });
        insertedPhrases.push(...result);
        console.log(`Inserted batch ${i / BATCH_SIZE + 1}/${Math.ceil(phrasesToInsert.length / BATCH_SIZE)}`);
      }
      console.log(`Inserted total ${insertedPhrases.length} Phrases.`);
    }
    const phraseIdMap = new Map(insertedPhrases.map(p => [p.phrase, p.id]));

    if (componentsToInsert.length > 0) {
      // Deduplicate components before insertion
      const componentSet = new Set<string>();
      const uniqueComponents = componentsToInsert
        .map(comp => ({
          phraseId: phraseIdMap.get(comp.phraseName),
          kanjiId: kanjiIdMap.get(comp.kanjiChar),
        }))
        .filter(comp => comp.phraseId !== undefined && comp.kanjiId !== undefined)
        .filter(comp => {
            const key = `${comp.phraseId}-${comp.kanjiId}`;
            if (componentSet.has(key)) {
                return false;
            }
            componentSet.add(key);
            return true;
        }) as PhraseComponent[];

      console.log(`Inserting ${uniqueComponents.length} unique Phrase Components in batches of ${BATCH_SIZE}...`);
      if (uniqueComponents.length > 0) {
        let insertedCount = 0;
        for (let i = 0; i < uniqueComponents.length; i += BATCH_SIZE) {
          const batch = uniqueComponents.slice(i, i + BATCH_SIZE);
          await tx.insert(phraseComponents).values(batch);
          insertedCount += batch.length;
          console.log(`Inserted component batch ${i / BATCH_SIZE + 1}/${Math.ceil(uniqueComponents.length / BATCH_SIZE)}`);
        }
         console.log(`Inserted total ${insertedCount} Phrase Components.`);
      } else {
         console.log("No valid phrase components to insert.");
      }
    }
  });
  console.log("Database transaction completed successfully.");
} catch (error) {
  console.error("Database transaction failed:", error);
  exit(1); // Exit with error code
}

console.log("Data import script finished.");
exit(0); // Exit successfully

