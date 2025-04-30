import list from "../data.json" assert { type: "json" };

const api = async (word: string) =>
  fetch(`https://jisho.org/api/v1/search/words?keyword=${word}`);

let index = 372;
while (index < list.length) {
  const { kanji } = list[index];
  try {
    const res = await api(kanji);
    const { data } = await res.json();

    for (const item of data) {
      const { slug } = item;
      if (slug.includes("-")) continue;
      if (/\d/.test(slug)) continue;
      const path = `./data/${slug}.json`;
      await Bun.write(path, JSON.stringify(item, null, 2));
    }

    console.log(`Wrote ${kanji} (${index}/${list.length})`);
    index++;
  } catch (e) {
    console.log(e);
  }
  await Bun.sleep(1000);
}
